package com.jdeveloperweb.javarag.api;

import com.jdeveloperweb.javarag.service.IngestionService;
import com.jdeveloperweb.javarag.service.TikaService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/ingestion")
@RequiredArgsConstructor
public class IngestionController {

    private final IngestionService ingestionService;
    private final TikaService tikaService;

    @PostMapping("/upload")
    public ResponseEntity<Long> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("tenantId") String tenantId,
            @RequestParam("collectionId") String collectionId) {
        
        String text = tikaService.extractText(file);
        Long docId = ingestionService.createDocument(
                file.getOriginalFilename(),
                text,
                tenantId,
                collectionId
        );
        return ResponseEntity.ok(docId);
    }

    @PostMapping("/process/{id}")
    public ResponseEntity<Void> processDocument(@PathVariable Long id) {
        ingestionService.markAsProcessing(id);
        ingestionService.processIngestionAsync(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/text")
    public ResponseEntity<Long> ingestText(@RequestBody IngestionRequest request) {
        Long docId = ingestionService.createDocument(
                request.getTitle(),
                request.getText(),
                request.getTenantId(),
                request.getCollectionId()
        );
        return ResponseEntity.ok(docId);
    }

    @Data
    public static class IngestionRequest {
        private String title;
        private String text;
        private String tenantId;
        private String collectionId;
    }
}
