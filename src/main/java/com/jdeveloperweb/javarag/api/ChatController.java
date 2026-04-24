package com.jdeveloperweb.javarag.api;

import com.jdeveloperweb.javarag.service.ChatService;
import com.jdeveloperweb.javarag.service.SpringAiChatService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class ChatController {

    private final ChatService chatService;
    private final SpringAiChatService springAiChatService;
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
        log.info("💬 [CHAT] Loading messages for conversation ID: {}", id);
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
