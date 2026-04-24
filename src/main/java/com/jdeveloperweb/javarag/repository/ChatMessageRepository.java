package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByConversationIdOrderByCreatedAtAsc(Long conversationId);
    void deleteByConversationId(Long conversationId);
    void deleteByConversationTenantId(String tenantId);
}
