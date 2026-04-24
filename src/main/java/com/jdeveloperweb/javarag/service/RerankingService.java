package com.jdeveloperweb.javarag.service;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.scoring.ScoringModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RerankingService {

    private final ModelService modelService;

    public List<TextSegment> rerank(String query, List<TextSegment> segments, int topN) {
        ScoringModel scoringModel = modelService.getScoringModel();
        
        if (scoringModel == null) {
            log.warn("⚠️ Reranking DESATIVADO: Provedor COHERE não configurado no banco de dados.");
            return segments.stream().limit(topN).collect(Collectors.toList());
        }

        if (segments.isEmpty()) {
            log.info("Reranking ignorado: Nenhuma parte de documento encontrada para reordenar.");
            return segments;
        }

        long startTime = System.currentTimeMillis();
        log.info("🚀 Iniciando Reranking de {} segmentos com Cohere...", segments.size());
        
        // LangChain4j ScoringModel.scoreAll returns scores for the pairs
        List<Double> scores = scoringModel.scoreAll(segments, query).content();

        long duration = System.currentTimeMillis() - startTime;
        log.info("✅ Reranking CONCLUÍDO em {}ms usando Cohere.", duration);

        // Pair segments with scores and sort
        return segments.stream()
                .sorted((s1, s2) -> {
                    int i1 = segments.indexOf(s1);
                    int i2 = segments.indexOf(s2);
                    return Double.compare(scores.get(i2), scores.get(i1));
                })
                .limit(topN)
                .collect(Collectors.toList());
    }
}
