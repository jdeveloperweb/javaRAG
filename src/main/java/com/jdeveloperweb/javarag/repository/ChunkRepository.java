package com.jdeveloperweb.javarag.repository;

import com.jdeveloperweb.javarag.model.Chunk;
import com.jdeveloperweb.javarag.model.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ChunkRepository extends JpaRepository<Chunk, Long> {
    List<Chunk> findByDocumentIdOrderByOrdinalAsc(Long documentId);
    long countByDocumentId(Long documentId);

    @Query(value = "SELECT * FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE tenant_id = :tenantId) AND to_tsvector('portuguese', text) @@ plainto_tsquery('portuguese', :query) ORDER BY ts_rank(to_tsvector('portuguese', text), plainto_tsquery('portuguese', :query)) DESC LIMIT 10", nativeQuery = true)
    List<Chunk> searchLexical(@Param("query") String query, @Param("tenantId") String tenantId);
}
