package com.jdeveloperweb.javarag.service;

import com.jdeveloperweb.javarag.model.RagasEvaluation;
import com.jdeveloperweb.javarag.model.RagasTestCase;
import com.jdeveloperweb.javarag.repository.RagasEvaluationRepository;
import com.jdeveloperweb.javarag.repository.RagasTestCaseRepository;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class RagasEvaluationService {

    private final ModelService modelService;
    private final ChatService chatService;
    private final RetrievalService retrievalService;
    private final RagasTestCaseRepository testCaseRepository;
    private final RagasEvaluationRepository evaluationRepository;

    /**
     * Executes a full RAG cycle and evaluates it using RAGAS metrics.
     */
    public RagasEvaluation evaluateTestCase(Long testCaseId, String provider, String tenantId) {
        RagasTestCase testCase = testCaseRepository.findById(testCaseId)
                .orElseThrow(() -> new RuntimeException("Test case not found: " + testCaseId));

        long startTime = System.currentTimeMillis();
        log.info("🚀 Starting RAGAS evaluation for Test Case {}: '{}'", testCaseId, testCase.getQuestion());

        // 1. Run RAG Pipeline
        // We use the retrieval service directly to get segments for evaluation
        List<TextSegment> segments = retrievalService.retrieveHybrid(testCase.getQuestion(), tenantId, 5);
        String context = segments.stream()
                .map(TextSegment::text)
                .collect(Collectors.joining("\n\n---\n\n"));

        // Generate Answer
        ChatService.ChatResponse response = chatService.chat(testCase.getQuestion(), provider, tenantId, null);
        String answer = response.getAnswer();

        // 2. Metrics Calculation (LLM-as-a-Judge)
        // We use a "Judge" model, preferably a stable/cheap one like gpt-4o-mini
        ChatLanguageModel judgeModel = modelService.getChatModel("OPENAI"); // Hardcoded to OpenAI for consistency in evaluation

        Double faithfulness = calculateFaithfulness(answer, context, judgeModel);
        Double answerRelevancy = calculateAnswerRelevancy(testCase.getQuestion(), answer, judgeModel);
        Double contextPrecision = calculateContextPrecision(testCase.getQuestion(), segments, judgeModel);
        Double contextRecall = calculateContextRecall(testCase.getGroundTruthAnswer(), context, judgeModel);

        Double overallScore = (faithfulness + answerRelevancy + contextPrecision + contextRecall) / 4.0;

        long duration = System.currentTimeMillis() - startTime;

        RagasEvaluation evaluation = RagasEvaluation.builder()
                .testCase(testCase)
                .question(testCase.getQuestion())
                .generatedAnswer(answer)
                .contextUsed(context)
                .faithfulnessScore(faithfulness)
                .answerRelevancyScore(answerRelevancy)
                .contextPrecisionScore(contextPrecision)
                .contextRecallScore(contextRecall)
                .overallScore(overallScore)
                .provider(provider)
                .evaluationTimeMillis(duration)
                .build();

        return evaluationRepository.save(evaluation);
    }

    @Async
    public void runBatchEvaluation(String tenantId, String provider) {
        List<RagasTestCase> testCases = testCaseRepository.findByTenantId(tenantId);
        log.info("📦 Running batch RAGAS evaluation for {} test cases", testCases.size());
        for (RagasTestCase tc : testCases) {
            try {
                evaluateTestCase(tc.getId(), provider, tenantId);
            } catch (Exception e) {
                log.error("Failed to evaluate test case {}", tc.getId(), e);
            }
        }
    }

    // --- Metric Implementations ---

    private Double calculateFaithfulness(String answer, String context, ChatLanguageModel judge) {
        try {
            // Step 1: Extract claims
            String extractionPrompt = """
                    Dado o texto abaixo, extraia todas as afirmações factuais independentes.
                    Retorne cada afirmação em uma nova linha precedida por um hífen (-).
                    Não inclua saudações ou explicações.
                    
                    TEXTO:
                    %s
                    """.formatted(answer);

            String claimsText = judge.generate(extractionPrompt);
            List<String> claims = Arrays.stream(claimsText.split("\n"))
                    .map(String::trim)
                    .filter(s -> s.startsWith("-"))
                    .map(s -> s.substring(1).trim())
                    .toList();

            if (claims.isEmpty()) return 1.0;

            // Step 2: Verify claims
            String verificationPrompt = """
                    Verifique se cada uma das afirmações abaixo é suportada pelo CONTEXTO fornecido.
                    Responda apenas com 'SIM' ou 'NÃO' para cada afirmação, em ordem, uma por linha.
                    
                    CONTEXTO:
                    %s
                    
                    AFIRMAÇÕES:
                    %s
                    """.formatted(context, String.join("\n", claims));

            String results = judge.generate(verificationPrompt);
            long supportedCount = Arrays.stream(results.split("\n"))
                    .map(String::trim)
                    .filter(s -> s.equalsIgnoreCase("SIM"))
                    .count();

            return (double) supportedCount / claims.size();
        } catch (Exception e) {
            log.error("Faithfulness error", e);
            return 0.0;
        }
    }

    private Double calculateAnswerRelevancy(String question, String answer, ChatLanguageModel judge) {
        try {
            String prompt = """
                    Avalie a relevância da RESPOSTA em relação à PERGUNTA.
                    A resposta resolve a dúvida do usuário? Ela é direta e útil?
                    Retorne apenas um número entre 0.0 (totalmente irrelevante) e 1.0 (perfeitamente relevante).
                    
                    PERGUNTA: %s
                    RESPOSTA: %s
                    
                    SCORE (0.0 a 1.0):""".formatted(question, answer);

            String scoreStr = judge.generate(prompt).trim();
            return Double.parseDouble(scoreStr.replaceAll("[^0-9.]", ""));
        } catch (Exception e) {
            log.error("Answer Relevancy error", e);
            return 0.0;
        }
    }

    private Double calculateContextPrecision(String question, List<TextSegment> segments, ChatLanguageModel judge) {
        try {
            if (segments.isEmpty()) return 0.0;

            int relevantCount = 0;
            for (TextSegment segment : segments) {
                String prompt = """
                        O seguinte fragmento de texto é útil para responder à pergunta fornecida?
                        Responda apenas 'SIM' ou 'NÃO'.
                        
                        PERGUNTA: %s
                        FRAGMENTO: %s
                        """.formatted(question, segment.text());

                String result = judge.generate(prompt).trim();
                if (result.equalsIgnoreCase("SIM")) {
                    relevantCount++;
                }
            }

            return (double) relevantCount / segments.size();
        } catch (Exception e) {
            log.error("Context Precision error", e);
            return 0.0;
        }
    }

    private Double calculateContextRecall(String groundTruth, String context, ChatLanguageModel judge) {
        try {
            String prompt = """
                    Verifique se a informação contida no 'GROUND TRUTH' (verdade absoluta) pode ser encontrada no 'CONTEXTO' fornecido.
                    Se toda a informação principal estiver presente, o score é 1.0. Se nada estiver presente, 0.0.
                    Retorne apenas o número do score entre 0.0 e 1.0.
                    
                    GROUND TRUTH: %s
                    CONTEXTO: %s
                    
                    SCORE (0.0 a 1.0):""".formatted(groundTruth, context);

            String scoreStr = judge.generate(prompt).trim();
            return Double.parseDouble(scoreStr.replaceAll("[^0-9.]", ""));
        } catch (Exception e) {
            log.error("Context Recall error", e);
            return 0.0;
        }
    }
}
