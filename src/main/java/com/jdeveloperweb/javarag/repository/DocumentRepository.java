package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, Long> {
}
