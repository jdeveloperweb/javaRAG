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

import java.text.Normalizer;
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
        return retrieveHybridInternal(query, tenantId, limit, 50, 0.25);
    }

    private List<TextSegment> retrieveHybridInternal(String query, String tenantId, int limit, int maxResults, double minScore) {
        // 1. Dense Retrieval
        EmbeddingModel embeddingModel = modelService.getEmbeddingModel("OPENAI");
        Filter tenantFilter = metadataKey("tenantId").isEqualTo(tenantId);

        var searchRequest = EmbeddingSearchRequest.builder()
                .queryEmbedding(embeddingModel.embed(query).content())
                .filter(tenantFilter)
                .maxResults(maxResults)
                .minScore(minScore)
                .build();

        List<TextSegment> denseResults = embeddingStore.search(searchRequest).matches().stream()
                .map(EmbeddingMatch::embedded)
                .collect(Collectors.toList());
        
        // 2. Lexical Retrieval
        String lexicalInput = Normalizer.normalize(query, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}", "")
                .replaceAll("[^a-zA-Z0-9 ]", " ");
        String tsQuery = Arrays.stream(lexicalInput.split("\\s+"))
                .filter(w -> w.length() >= 3)
                .distinct()
                .collect(Collectors.joining(" or "));

        if (tsQuery.isBlank()) {
            tsQuery = lexicalInput.trim();
        }

        List<Chunk> lexicalChunks = chunkRepository.searchLexical(tsQuery, tenantId);
        List<TextSegment> lexicalResults = lexicalChunks.stream()
                .map(chunk -> {
                    Map<String, Object> metadataMap = new HashMap<>();
                    metadataMap.put("title", chunk.getDocument().getTitle());
                    metadataMap.put("documentId", String.valueOf(chunk.getDocument().getId()));
                    metadataMap.put("tenantId", tenantId);
                    metadataMap.put("ordinal", String.valueOf(chunk.getOrdinal()));
                    return TextSegment.from(chunk.getText(), dev.langchain4j.data.document.Metadata.from(metadataMap));
                })
                .collect(Collectors.toList());

        // 3. RRF Fusion
        Map<String, Double> rrfScores = new HashMap<>();
        Map<String, TextSegment> segmentMap = new HashMap<>();
        int kDense = 60;
        int kLexical = 20;

        for (int i = 0; i < denseResults.size(); i++) {
            TextSegment segment = denseResults.get(i);
            String text = segment.text();
            segmentMap.put(text, segment);
            rrfScores.put(text, rrfScores.getOrDefault(text, 0.0) + (1.0 / (kDense + i + 1)));
        }

        for (int i = 0; i < lexicalResults.size(); i++) {
            TextSegment segment = lexicalResults.get(i);
            String text = segment.text();
            segmentMap.putIfAbsent(text, segment);
            rrfScores.put(text, rrfScores.getOrDefault(text, 0.0) + (1.0 / (kLexical + i + 1)));
        }

        List<TextSegment> candidates = rrfScores.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(entry -> segmentMap.get(entry.getKey()))
                .collect(Collectors.toList());

        // 4. Reranking
        List<TextSegment> reranked = rerankingService.rerank(query, candidates, limit);

        // 5. Window expansion
        return expandWindow(reranked);
    }

    public List<TextSegment> retrieveExhaustive(String query, String tenantId, int limit, String provider) {
        log.info("🚀 [EXHAUSTIVE] Generating query variations for: {}", query);
        List<String> variations = generateQueryVariations(query, provider);
        variations.add(query); // Include original

        Map<String, Double> globalRrfScores = new HashMap<>();
        Map<String, TextSegment> globalSegmentMap = new HashMap<>();

        for (String q : variations) {
            log.info("🔍 [EXHAUSTIVE] Searching variation: {}", q);
            // Use a lower minScore and higher maxResults for variations to catch more edge cases
            List<TextSegment> variationResults = retrieveHybridInternal(q, tenantId, 20, 100, 0.15);
            
            for (int i = 0; i < variationResults.size(); i++) {
                TextSegment segment = variationResults.get(i);
                String text = segment.text();
                globalSegmentMap.putIfAbsent(text, segment);
                // Simple RRF across multiple searches
                globalRrfScores.put(text, globalRrfScores.getOrDefault(text, 0.0) + (1.0 / (60 + i + 1)));
            }
        }

        List<TextSegment> merged = globalRrfScores.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(limit * 2L)
                .map(entry -> globalSegmentMap.get(entry.getKey()))
                .collect(Collectors.toList());

        log.info("🔀 [EXHAUSTIVE] Merged results from {} queries into {} unique segments", variations.size(), merged.size());
        
        // Final Rerank with original query
        List<TextSegment> finalResults = rerankingService.rerank(query, merged, limit);
        return expandWindow(finalResults);
    }

    private List<String> generateQueryVariations(String query, String provider) {
        dev.langchain4j.model.chat.ChatLanguageModel model = modelService.getChatModel(provider);
        String prompt = String.format("""
                Dada a pergunta do usuário, gere 3 variações de busca curtas e objetivas para encontrar informações em um banco de dados técnico (esquemas SQL, tabelas e campos).
                Foque em termos técnicos e sinônimos.
                
                PERGUNTA: %s
                
                Retorne apenas as variações, uma por linha, sem números ou explicações.
                """, query);
        
        String response = model.generate(prompt);
        return Arrays.stream(response.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toList());
    }

    private List<TextSegment> expandWindow(List<TextSegment> segments) {
        return segments.stream().map(segment -> {
            String docIdStr = segment.metadata().getString("documentId");
            String ordinalStr = segment.metadata().getString("ordinal");
            if (docIdStr == null || ordinalStr == null) return segment;
            int ordinal = Integer.parseInt(ordinalStr);
            if (ordinal <= 1) return segment;
            return chunkRepository
                    .findByDocumentIdAndOrdinal(Long.parseLong(docIdStr), ordinal - 1)
                    .map(prev -> TextSegment.from(prev.getText() + "\n" + segment.text(), segment.metadata()))
                    .orElse(segment);
        }).collect(Collectors.toList());
    }
}
