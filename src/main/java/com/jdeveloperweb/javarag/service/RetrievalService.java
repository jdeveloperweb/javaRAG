package com.jdeveloperweb.javarag.service;

import com.jdeveloperweb.javarag.model.Chunk;
import com.jdeveloperweb.javarag.repository.ChunkRepository;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingMatch;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.Filter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

import static dev.langchain4j.store.embedding.filter.MetadataFilterBuilder.metadataKey;

@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class RetrievalService {

    private final EmbeddingStore<TextSegment> embeddingStore;
    private final ChunkRepository chunkRepository;
    private final ModelService modelService;
    private final RerankingService rerankingService;

    public List<TextSegment> retrieveHybrid(String query, String tenantId, int limit) {
        // 1. Dense Retrieval (Vector)
        EmbeddingModel embeddingModel = modelService.getEmbeddingModel("OPENAI");
        Filter tenantFilter = metadataKey("tenantId").isEqualTo(tenantId);
        
        var searchRequest = EmbeddingSearchRequest.builder()
                .queryEmbedding(embeddingModel.embed(query).content())
                .filter(tenantFilter)
                .maxResults(limit)
                .build();

        List<TextSegment> denseResults = embeddingStore.search(searchRequest).matches().stream()
                .map(EmbeddingMatch::embedded)
                .collect(Collectors.toList());
        log.info("📡 [VECTOR] Found {} dense candidates", denseResults.size());

        // 2. Lexical Retrieval (Keywords)
        List<Chunk> lexicalChunks = chunkRepository.searchLexical(query, tenantId);
        List<TextSegment> lexicalResults = lexicalChunks.stream()
                .map(chunk -> TextSegment.from(chunk.getText(), 
                        dev.langchain4j.data.document.Metadata.from("title", chunk.getDocument().getTitle())))
                .collect(Collectors.toList());
        log.info("📖 [LEXICAL] Found {} lexical candidates", lexicalResults.size());

        // 3. Reciprocal Rank Fusion (RRF)
        Map<String, Double> rrfScores = new HashMap<>();
        Map<String, TextSegment> segmentMap = new HashMap<>();
        int k = 60;

        for (int i = 0; i < denseResults.size(); i++) {
            TextSegment segment = denseResults.get(i);
            String text = segment.text();
            segmentMap.put(text, segment);
            rrfScores.put(text, rrfScores.getOrDefault(text, 0.0) + (1.0 / (k + i + 1)));
        }

        for (int i = 0; i < lexicalResults.size(); i++) {
            TextSegment segment = lexicalResults.get(i);
            String text = segment.text();
            segmentMap.putIfAbsent(text, segment);
            rrfScores.put(text, rrfScores.getOrDefault(text, 0.0) + (1.0 / (k + i + 1)));
        }

        List<TextSegment> candidates = rrfScores.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(entry -> segmentMap.get(entry.getKey()))
                .collect(Collectors.toList());
        log.info("🔀 [FUSION] Applied RRF to {} unique candidates", candidates.size());

        // 4. Reranking
        return rerankingService.rerank(query, candidates, limit);
    }
}
