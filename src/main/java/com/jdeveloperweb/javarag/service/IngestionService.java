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
    public Long ingestText(String title, String text, String tenantId, String collectionId) {
        log.info("🚀 [INGESTION] Starting ingestion for document: '{}'", title);

        // 1. Create and save Document metadata
        Document document = Document.builder()
                .title(title)
                .tenantId(tenantId)
                .collectionId(collectionId)
                .status(Document.DocumentStatus.RECEIVED)
                .build();
        document = documentRepository.save(document);

        try {
            // 2. Chunking
            log.info("✂️ [STAGE] Chunking text...");
            document.setStatus(Document.DocumentStatus.CHUNKING);
            documentRepository.save(document);
            
            DocumentSplitter splitter = DocumentSplitters.recursive(500, 100);
            dev.langchain4j.data.document.Document lcDocument = dev.langchain4j.data.document.Document.from(text);
            List<TextSegment> segments = splitter.split(lcDocument);
            log.info("📦 [CHUNK] Document split into {} segments", segments.size());

            // 3. Embeddings & Indexing
            log.info("🧠 [STAGE] Generating embeddings and indexing...");
            document.setStatus(Document.DocumentStatus.EMBEDDING);
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
            }
            chunkRepository.saveAll(chunks);

            document.setStatus(Document.DocumentStatus.INDEXED);
            documentRepository.save(document);
            log.info("✅ [INGESTION] Completed: {} chunks indexed for '{}'", segments.size(), title);

            return document.getId();
        } catch (Exception e) {
            log.error("Error ingesting document: {}", title, e);
            document.setStatus(Document.DocumentStatus.FAILED);
            documentRepository.save(document);
            throw new RuntimeException("Ingestion failed", e);
        }
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
