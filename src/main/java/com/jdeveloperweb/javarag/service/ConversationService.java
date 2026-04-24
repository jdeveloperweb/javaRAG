package com.jdeveloperweb.javarag.service;

import com.jdeveloperweb.javarag.model.Conversation;
import com.jdeveloperweb.javarag.model.ChatMessage;
import com.jdeveloperweb.javarag.repository.ConversationRepository;
import com.jdeveloperweb.javarag.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository chatMessageRepository;

    public List<Conversation> findAllByTenant(String tenantId) {
        return conversationRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    public List<ChatMessage> findMessagesByConversation(Long conversationId) {
        return chatMessageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    public Conversation createConversation(String title, String tenantId) {
        Conversation conversation = Conversation.builder()
                .title(title)
                .tenantId(tenantId)
                .build();
        return conversationRepository.save(conversation);
    }

    public Optional<Conversation> findById(Long id) {
        return conversationRepository.findById(id);
    }

    @Transactional
    public void deleteConversation(Long id) {
        chatMessageRepository.deleteByConversationId(id);
        conversationRepository.deleteById(id);
    }

    @Transactional
    public void deleteAllByTenant(String tenantId) {
        chatMessageRepository.deleteByConversationTenantId(tenantId);
        conversationRepository.deleteByTenantId(tenantId);
    }
}
