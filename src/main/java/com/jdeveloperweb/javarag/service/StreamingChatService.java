package com.jdeveloperweb.javarag.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jdeveloperweb.javarag.model.AuditLog;
import com.jdeveloperweb.javarag.model.ChatMessage;
import com.jdeveloperweb.javarag.model.Conversation;
import com.jdeveloperweb.javarag.repository.AuditLogRepository;
import com.jdeveloperweb.javarag.repository.ChatMessageRepository;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.model.StreamingResponseHandler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StreamingChatService {

    private final ModelService modelService;
    private final RetrievalService retrievalService;
    private final AuditLogRepository auditLogRepository;
    private final ConversationService conversationService;
    private final ChatMessageRepository chatMessageRepository;
    private final TokenCostService tokenCostService;
    private final MetricsService metricsService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    public void streamChat(SseEmitter emitter, String question, String provider,
                           String tenantId, Long conversationId) {
        long startTime = System.currentTimeMillis();
        log.info("[STREAM] Chat request for tenant {}: {}", tenantId, question);

        try {
            // 1. Get streaming model
            StreamingChatLanguageModel streamingModel = modelService.getStreamingChatModel(provider);

            // 2. Hybrid Retrieval
            List<TextSegment> segments = retrievalService.retrieveHybrid(question, tenantId, 5);

            if (segments.isEmpty()) {
                sendEvent(emitter, "token", "Não encontrei evidência suficiente no material recuperado para responder com segurança.");
                sendEvent(emitter, "done", objectMapper.writeValueAsString(
                        new StreamDonePayload(null, provider, 0, 0)));
                emitter.complete();
                return;
            }

            // 3. Build citations and send them first
            List<ChatService.Citation> citations = segments.stream()
                    .map(segment -> {
                        String docIdStr = segment.metadata().getString("documentId");
                        Long docId = null;
                        try {
                            if (docIdStr != null) docId = Long.parseLong(docIdStr);
                        } catch (NumberFormatException e) {
                            log.warn("Invalid documentId in metadata: {}", docIdStr);
                        }

                        return ChatService.Citation.builder()
                                .source(segment.metadata().getString("title"))
                                .text(segment.text())
                                .documentId(docId)
                                .build();
                    })
                    .collect(Collectors.toList());

            sendEvent(emitter, "citations", objectMapper.writeValueAsString(citations));

            // 4. Construct context
            StringBuilder contextBuilder = new StringBuilder();
            for (int i = 0; i < segments.size(); i++) {
                TextSegment segment = segments.get(i);
                contextBuilder.append(String.format("Citação [%d]: %s\nFonte: %s\n\n",
                        i + 1, segment.text(), segment.metadata().getString("title")));
            }

            // 5. Construct Prompt
            String systemPrompt = """
                    Você é um especialista em análise de documentos corporativos.
                    Seu objetivo é fornecer respostas precisas, úteis e fundamentadas no CONTEXTO fornecido.
                    
                    DIRETRIZES:
                    1. Analise cuidadosamente todos os fragmentos do CONTEXTO AUTORIZADO.
                    2. Tente conectar as informações entre diferentes fragmentos para compor uma resposta completa.
                    3. Use um tom profissional e prestativo.
                    4. SEMPRE cite as fontes usando o formato [n] ao lado de cada afirmação.
                    
                    REGRAS DE SEGURANÇA:
                    - Se a informação NÃO estiver no contexto de forma alguma, explique educadamente o que você encontrou e o que está faltando.
                    - Evite dizer apenas "Não encontrei evidência" se houver informações parciais ou relacionadas; em vez disso, apresente o que foi encontrado.
                    - Nunca invente fatos ou datas.
                    
                    FORMATO:
                    - Resposta em português do Brasil.
                    - Ao final, inclua uma seção chamada "Base consultada" com os títulos únicos dos documentos utilizados.
                    """;

            String userPrompt = String.format("""
                    PERGUNTA DO USUÁRIO:
                    %s
                    
                    CONTEXTO AUTORIZADO:
                    %s
                    """, question, contextBuilder.toString());

            // 6. Stream LLM response
            StringBuilder fullResponse = new StringBuilder();

            streamingModel.generate(
                    List.of(new SystemMessage(systemPrompt), new UserMessage(userPrompt)),
                    new StreamingResponseHandler<AiMessage>() {
                        @Override
                        public void onNext(String token) {
                            fullResponse.append(token);
                            try {
                                sendEvent(emitter, "token", token);
                            } catch (Exception e) {
                                log.warn("[STREAM] Client disconnected during streaming: {}", e.getMessage());
                            }
                        }

                        @Override
                        public void onComplete(Response<AiMessage> response) {
                            try {
                                long duration = System.currentTimeMillis() - startTime;
                                String answer = fullResponse.toString();

                                // Persist conversation & messages
                                Conversation conversation = resolveConversation(
                                        conversationId, question, tenantId);

                                chatMessageRepository.save(ChatMessage.builder()
                                        .conversation(conversation)
                                        .content(question)
                                        .role("USER")
                                        .build());

                                String citationsJson = null;
                                try {
                                    citationsJson = objectMapper.writeValueAsString(citations);
                                } catch (Exception e) {
                                    log.error("Failed to serialize citations", e);
                                }

                                chatMessageRepository.save(ChatMessage.builder()
                                        .conversation(conversation)
                                        .content(answer)
                                        .role("ASSISTANT")
                                        .citationsJson(citationsJson)
                                        .build());

                                // Token usage
                                var usage = response.tokenUsage();
                                int pTokens = (usage != null) ? usage.inputTokenCount() : 0;
                                int cTokens = (usage != null) ? usage.outputTokenCount() : 0;
                                double cost = tokenCostService.calculateCost(provider, pTokens, cTokens);

                                // Audit Log
                                auditLogRepository.save(AuditLog.builder()
                                        .tenantId(tenantId)
                                        .userQuery(question)
                                        .aiResponse(answer)
                                        .modelUsed(provider + " (Streaming)")
                                        .responseTimeMillis(duration)
                                        .promptTokens(pTokens)
                                        .completionTokens(cTokens)
                                        .totalTokens(pTokens + cTokens)
                                        .estimatedCost(cost)
                                        .build());

                                metricsService.recordUsage(provider, pTokens, cTokens, cost);

                                log.info("[STREAM] Completed in {}ms | Tokens: {}+{}",
                                        duration, pTokens, cTokens);

                                // Send done event
                                sendEvent(emitter, "done", objectMapper.writeValueAsString(
                                        new StreamDonePayload(
                                                conversation.getId(), provider + " (Streaming)",
                                                pTokens, cTokens)));
                                emitter.complete();
                            } catch (Exception e) {
                                log.error("[STREAM] Error in onComplete", e);
                                emitter.completeWithError(e);
                            }
                        }

                        @Override
                        public void onError(Throwable error) {
                            log.error("[STREAM] LLM streaming error", error);
                            try {
                                sendEvent(emitter, "error",
                                        objectMapper.writeValueAsString(
                                                new StreamErrorPayload(error.getMessage())));
                            } catch (Exception e) {
                                log.error("[STREAM] Failed to send error event", e);
                            }
                            emitter.completeWithError(error);
                        }
                    }
            );

        } catch (Exception e) {
            log.error("[STREAM] Error starting stream", e);
            try {
                sendEvent(emitter, "error",
                        objectMapper.writeValueAsString(
                                new StreamErrorPayload(e.getMessage())));
            } catch (Exception ex) {
                log.error("[STREAM] Failed to send error event", ex);
            }
            emitter.completeWithError(e);
        }
    }

    private Conversation resolveConversation(Long conversationId, String question, String tenantId) {
        if (conversationId == null) {
            String title = question.length() > 30 ? question.substring(0, 30) + "..." : question;
            return conversationService.createConversation(title, tenantId);
        }
        return conversationService.findById(conversationId).orElseGet(() ->
                conversationService.createConversation(
                        question.substring(0, Math.min(question.length(), 30)), tenantId));
    }

    private void sendEvent(SseEmitter emitter, String eventName, String data) throws IOException {
        emitter.send(SseEmitter.event()
                .name(eventName)
                .data(data));
    }

    // Payload DTOs
    public record StreamDonePayload(Long conversationId, String modelUsed,
                                    int promptTokens, int completionTokens) {}

    public record StreamErrorPayload(String message) {}
}
