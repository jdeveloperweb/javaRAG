package com.jdeveloperweb.javarag.api;

import com.jdeveloperweb.javarag.model.Chunk;
import com.jdeveloperweb.javarag.model.Document;
import com.jdeveloperweb.javarag.repository.DocumentRepository;
import com.jdeveloperweb.javarag.repository.ChunkRepository;
import com.jdeveloperweb.javarag.service.IngestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentRepository documentRepository;
    private final ChunkRepository chunkRepository;
    private final IngestionService ingestionService;

    @GetMapping
    public List<Document> listDocuments() {
        List<Document> documents = documentRepository.findAll();
        documents.forEach(doc -> doc.setChunkCount(chunkRepository.countByDocumentId(doc.getId())));
        return documents;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Document> getDocument(@PathVariable Long id) {
        return documentRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/chunks")
    public List<Chunk> getChunks(@PathVariable Long id) {
        return chunkRepository.findByDocumentIdOrderByOrdinalAsc(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(@PathVariable Long id) {
        if (documentRepository.existsById(id)) {
            documentRepository.deleteById(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/all")
    public ResponseEntity<Void> deleteAll() {
        System.out.println("DEBUG: Received request to delete ALL documents");
        ingestionService.deleteAll();
        return ResponseEntity.ok().build();
    }
}
