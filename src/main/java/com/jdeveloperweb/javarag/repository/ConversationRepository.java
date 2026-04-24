package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    void deleteByTenantId(String tenantId);
}
