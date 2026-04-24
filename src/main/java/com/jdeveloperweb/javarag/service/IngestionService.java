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
            
            // 1. Chunking
            log.info("[STAGE] Chunking text...");
            document.setStatus(Document.DocumentStatus.CHUNKING);
            document.setProgress(20);
            documentRepository.save(document);
            
            DocumentSplitter splitter = DocumentSplitters.recursive(1000, 200);
            dev.langchain4j.data.document.Document lcDocument = dev.langchain4j.data.document.Document.from(text);
            List<TextSegment> segments = splitter.split(lcDocument);
            log.info("[CHUNK] Document split into {} segments", segments.size());

            // 2. Embeddings & Indexing
            log.info("[STAGE] Generating embeddings and indexing...");
            document.setStatus(Document.DocumentStatus.EMBEDDING);
            document.setProgress(50);
            documentRepository.save(document);
            
            EmbeddingModel embeddingModel = modelService.getEmbeddingModel("OPENAI");

            List<Chunk> chunks = new ArrayList<>();
            for (int i = 0; i < segments.size(); i++) {
                TextSegment segment = segments.get(i);

                segment.metadata().put("documentId", document.getId().toString());
                segment.metadata().put("tenantId", tenantId);
                segment.metadata().put("collectionId", collectionId);
                segment.metadata().put("title", title);

                Embedding embedding = embeddingModel.embed(segment).content();
                String embeddingId = embeddingStore.add(embedding, segment);

                Chunk chunk = Chunk.builder()
                        .document(document)
                        .text(segment.text())
                        .ordinal(i + 1)
                        .chunkExternalId(embeddingId)
                        .build();
                chunks.add(chunk);
                
                // Update progress every 10%
                if (segments.size() > 10 && i % (segments.size() / 10) == 0) {
                    int currentProgress = 50 + (int) ((i / (float) segments.size()) * 45);
                    document.setProgress(currentProgress);
                    documentRepository.save(document);
                }
            }
            chunkRepository.saveAll(chunks);

            document.setStatus(Document.DocumentStatus.INDEXED);
            document.setProgress(100);
            documentRepository.save(document);
            log.info("[INGESTION] Completed: {} chunks indexed for '{}'", segments.size(), title);

        } catch (Exception e) {
            log.error("Error ingesting document: {}", title, e);
            document.setStatus(Document.DocumentStatus.FAILED);
            document.setProgress(100);
            documentRepository.save(document);
        }
    }

    @Transactional
    public void deleteDocument(Long id) {
        Document document = documentRepository.findById(id).orElse(null);
        if (document == null) return;
        
        List<Chunk> chunks = chunkRepository.findByDocumentIdOrderByOrdinalAsc(id);
        List<String> embeddingIds = chunks.stream()
                .map(Chunk::getChunkExternalId)
                .filter(java.util.Objects::nonNull)
                .toList();
                
        if (!embeddingIds.isEmpty()) {
            String idsList = embeddingIds.stream().map(eid -> "'" + eid + "'").collect(java.util.stream.Collectors.joining(","));
            try {
                entityManager.createNativeQuery("DELETE FROM test_embeddings WHERE id::text IN (" + idsList + ")").executeUpdate();
            } catch (Exception e) {
                log.error("Failed to delete embeddings for document {}", id, e);
            }
        }
        
        chunkRepository.deleteAllInBatch(chunks);
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
