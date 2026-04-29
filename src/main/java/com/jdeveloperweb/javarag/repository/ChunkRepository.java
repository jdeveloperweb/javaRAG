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
    java.util.Optional<Chunk> findByDocumentIdAndOrdinal(Long documentId, Integer ordinal);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM Chunk c WHERE c.document.id = :documentId")
    void deleteByDocumentId(@org.springframework.data.repository.query.Param("documentId") Long documentId);

    // replace(text, '_', ' ') separa identificadores SQL compostos em lexemas individuais.
    // websearch_to_tsquery('portuguese') aceita texto livre, remove stopwords PT e aplica stemming,
    // eliminando a necessidade de listas hardcoded no código Java.
    @Query(value = "SELECT * FROM chunks WHERE document_id IN (SELECT id FROM documents WHERE tenant_id = :tenantId) " +
                   "AND to_tsvector('portuguese', replace(text, '_', ' ')) @@ websearch_to_tsquery('portuguese', :query) " +
                   "ORDER BY ts_rank(to_tsvector('portuguese', replace(text, '_', ' ')), websearch_to_tsquery('portuguese', :query)) DESC LIMIT 20", nativeQuery = true)
    List<Chunk> searchLexical(@Param("query") String query, @Param("tenantId") String tenantId);
}
