package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface DocumentRepository extends JpaRepository<Document, Long> {

    @Modifying
    @Transactional
    @Query("UPDATE Document d SET d.progress = :progress WHERE d.id = :id")
    void updateProgress(@Param("id") Long id, @Param("progress") int progress);

    @Modifying
    @Transactional
    @Query("UPDATE Document d SET d.status = :status, d.progress = :progress WHERE d.id = :id")
    void updateStatusAndProgress(@Param("id") Long id,
                                 @Param("status") Document.DocumentStatus status,
                                 @Param("progress") int progress);
}
