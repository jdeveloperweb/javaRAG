package com.jdeveloperweb.javarag.api;

import com.jdeveloperweb.javarag.service.ChatService;
import com.jdeveloperweb.javarag.service.SpringAiChatService;
import com.jdeveloperweb.javarag.service.StreamingChatService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class ChatController {

    private final ChatService chatService;
    private final SpringAiChatService springAiChatService;
    private final StreamingChatService streamingChatService;
    private final com.jdeveloperweb.javarag.service.ConversationService conversationService;

    @PostMapping("/query")
    public ResponseEntity<ChatService.ChatResponse> query(@RequestBody ChatRequest request) {
        ChatService.ChatResponse response;
        if (Boolean.TRUE.equals(request.getUseSpringAi())) {
            response = springAiChatService.chat(
                    request.getMessage(),
                    request.getProvider(),
                    request.getTenantId(),
                    request.getConversationId()
            );
        } else {
            response = chatService.chat(
                    request.getMessage(),
                    request.getProvider(),
                    request.getTenantId(),
                    request.getConversationId()
            );
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamQuery(@RequestBody ChatRequest request,
                                   jakarta.servlet.http.HttpServletResponse response) {
        // Prevent proxy buffering (critical for Vite dev proxy + SSE)
        response.setHeader("X-Accel-Buffering", "no");
        response.setHeader("Cache-Control", "no-cache");

        SseEmitter emitter = new SseEmitter(120_000L); // 2 minute timeout

        emitter.onCompletion(() -> log.debug("[SSE] Emitter completed"));
        emitter.onTimeout(() -> {
            log.warn("[SSE] Emitter timed out");
            emitter.complete();
        });
        emitter.onError(ex -> log.warn("[SSE] Emitter error: {}", ex.getMessage()));

        streamingChatService.streamChat(
                emitter,
                request.getMessage(),
                request.getProvider(),
                request.getTenantId(),
                request.getConversationId()
        );

        return emitter;
    }

    @Data
    public static class ChatRequest {
        private String message;
        private String provider; // OPENAI or ANTHROPIC
        private String tenantId;
        private Boolean useSpringAi;
        private Long conversationId;
    }

    @GetMapping("/conversations")
    public ResponseEntity<?> getConversations(@RequestParam(defaultValue = "default") String tenantId) {
        return ResponseEntity.ok(conversationService.findAllByTenant(tenantId));
    }

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<?> getMessages(@PathVariable Long id) {
        log.info("[CHAT] Loading messages for conversation ID: {}", id);
        return ResponseEntity.ok(conversationService.findMessagesByConversation(id));
    }

    @DeleteMapping("/conversations/{id}")
    public ResponseEntity<?> deleteConversation(@PathVariable Long id) {
        conversationService.deleteConversation(id);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/conversations")
    public ResponseEntity<?> deleteAllConversations(@RequestParam(defaultValue = "default") String tenantId) {
        conversationService.deleteAllByTenant(tenantId);
        return ResponseEntity.ok().build();
    }
}

