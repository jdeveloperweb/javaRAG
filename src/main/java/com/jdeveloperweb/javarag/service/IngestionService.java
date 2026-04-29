package com.jdeveloperweb.javarag.service;

import com.jdeveloperweb.javarag.model.Chunk;
import com.jdeveloperweb.javarag.model.Document;
import com.jdeveloperweb.javarag.repository.ChunkRepository;
import com.jdeveloperweb.javarag.repository.DocumentRepository;
import dev.langchain4j.data.document.DocumentSplitter;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
@Slf4j
public class IngestionService {

    private final DocumentRepository documentRepository;
    private final ChunkRepository chunkRepository;
    private final ModelService modelService;
    private final EmbeddingStore<TextSegment> embeddingStore;
    private final jakarta.persistence.EntityManager entityManager;

    @Transactional
    public Long createDocument(String title, String text, String tenantId, String collectionId) {
        log.info("[INGESTION] Creating document record: '{}'", title);
        Document document = Document.builder()
                .title(title)
                .tenantId(tenantId)
                .collectionId(collectionId)
                .extractedText(text)
                .status(Document.DocumentStatus.RECEIVED)
                .progress(0)
                .build();
        return documentRepository.save(document).getId();
    }

    @Transactional
    public void markAsProcessing(Long documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));
        log.info("[INGESTION] Marking document {} as PROCESSING (CHUNKING stage)", documentId);
        document.setStatus(Document.DocumentStatus.CHUNKING);
        document.setProgress(5); // Initial progress to show the bar immediately
        documentRepository.save(document);
    }

    @org.springframework.scheduling.annotation.Async
    public void processIngestionAsync(Long documentId) {
        Document document = documentRepository.findById(documentId)
                .orElseThrow(() -> new RuntimeException("Document not found: " + documentId));
        
        String title = document.getTitle();
        String text = document.getExtractedText();
        String tenantId = document.getTenantId();
        String collectionId = document.getCollectionId();

        try {
            log.info("[INGESTION] Starting async processing for: '{}'", title);

            DocumentSplitter splitter = DocumentSplitters.recursive(1000, 200);
            List<TextSegment> segments = splitter.split(dev.langchain4j.data.document.Document.from(text));
            int totalSegments = segments.size();
            // Libera os 3MB de texto da heap — segments já tem tudo que precisamos
            document.setExtractedText(null);
            log.info("[CHUNK] Document '{}' split into {} segments", title, totalSegments);

            documentRepository.updateStatusAndProgress(documentId, Document.DocumentStatus.EMBEDDING, 10);

            EmbeddingModel embeddingModel = modelService.getEmbeddingModel("OPENAI");

            // Virtual threads: cada lote roda em seu próprio virtual thread.
            // Semaphore limita chamadas simultâneas à API da OpenAI (evita rate limit 429).
            // Lotes são I/O-bound (HTTP + DB), exatamente o caso de uso de virtual threads.
            final int BATCH_SIZE = 100;
            final int MAX_CONCURRENT = 4;
            Semaphore semaphore = new Semaphore(MAX_CONCURRENT);
            AtomicInteger completedChunks = new AtomicInteger(0);
            List<Future<?>> futures = new ArrayList<>();

            try (ExecutorService virtualExecutor = Executors.newVirtualThreadPerTaskExecutor()) {
                for (int batchStart = 0; batchStart < totalSegments; batchStart += BATCH_SIZE) {
                    final int start = batchStart;
                    final int end = Math.min(batchStart + BATCH_SIZE, totalSegments);
                    final List<TextSegment> batch = new ArrayList<>(segments.subList(start, end));

                    for (int mi = 0; mi < batch.size(); mi++) {
                        TextSegment segment = batch.get(mi);
                        segment.metadata().put("documentId", documentId.toString());
                        segment.metadata().put("tenantId", tenantId);
                        segment.metadata().put("collectionId", collectionId);
                        segment.metadata().put("title", title);
                        segment.metadata().put("ordinal", String.valueOf(start + mi + 1));
                    }

                    futures.add(virtualExecutor.submit(() -> {
                        semaphore.acquire();
                        try {
                            List<Embedding> embeddings = embeddingModel.embedAll(batch).content();
                            List<String> embeddingIds = embeddingStore.addAll(embeddings, batch);

                            List<Chunk> batchChunks = new ArrayList<>(batch.size());
                            for (int i = 0; i < batch.size(); i++) {
                                batchChunks.add(Chunk.builder()
                                        .document(document)
                                        .text(batch.get(i).text())
                                        .ordinal(start + i + 1)
                                        .chunkExternalId(embeddingIds.get(i))
                                        .build());
                            }
                            chunkRepository.saveAll(batchChunks);

                            int done = completedChunks.addAndGet(batch.size());
                            int progress = 10 + (int) ((done / (float) totalSegments) * 85);
                            documentRepository.updateProgress(documentId, progress);
                            log.info("[INGESTION] Lote {}/{} concluído", end, totalSegments);
                            return null;
                        } finally {
                            semaphore.release();
                        }
                    }));
                }

                for (Future<?> future : futures) {
                    future.get();
                }
            }

            segments.clear();
            documentRepository.updateStatusAndProgress(documentId, Document.DocumentStatus.INDEXED, 100);
            log.info("[INGESTION] Concluído: {} chunks indexados para '{}'", totalSegments, title);

        } catch (Exception e) {
            log.error("Error ingesting document: {}", title, e);
            documentRepository.updateStatusAndProgress(documentId, Document.DocumentStatus.FAILED, 100);
        }
    }

    @Transactional
    public void deleteDocument(Long id) {
        Document document = documentRepository.findById(id).orElse(null);
        if (document == null) return;

        // Busca só os IDs de embedding para limpar o pgvector — sem carregar o texto dos chunks
        List<String> embeddingIds = chunkRepository.findByDocumentIdOrderByOrdinalAsc(id).stream()
                .map(Chunk::getChunkExternalId)
                .filter(java.util.Objects::nonNull)
                .toList();

        if (!embeddingIds.isEmpty()) {
            try {
                embeddingStore.removeAll(embeddingIds);
            } catch (Exception e) {
                log.error("Failed to delete embeddings for document {}", id, e);
            }
        }

        // DELETE FROM chunks WHERE document_id = ? — uma condição, não um OR por chunk
        chunkRepository.deleteByDocumentId(id);
        documentRepository.delete(document);
    }

    @Transactional
    public void deleteAll() {
        log.warn("DELETING ALL DATA from database and vector store...");
        
        // 1. Delete chunks first (foreign key dependency)
        chunkRepository.deleteAllInBatch();
        
        // 2. Delete documents
        documentRepository.deleteAllInBatch();
        
        // 3. Truncate the embedding store table (PgVector)
        entityManager.createNativeQuery("TRUNCATE TABLE test_embeddings RESTART IDENTITY CASCADE").executeUpdate();
        
        log.info("System reset completed successfully.");
    }
}
