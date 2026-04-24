package com.jdeveloperweb.javarag.util;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseFixer implements ApplicationRunner {

    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            log.info("Attempting to drop problematic check constraint 'documents_status_check'...");
            entityManager.createNativeQuery("ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check").executeUpdate();
            log.info("Constraint dropped successfully (if it existed).");
        } catch (Exception e) {
            log.error("Failed to drop constraint: {}", e.getMessage());
        }
    }
}
