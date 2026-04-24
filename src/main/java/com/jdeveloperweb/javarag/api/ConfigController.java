package com.jdeveloperweb.javarag.api;

import com.jdeveloperweb.javarag.service.ModelService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/config")
@RequiredArgsConstructor
public class ConfigController {

    private final ModelService modelService;
    
    @GetMapping
    public ResponseEntity<java.util.List<com.jdeveloperweb.javarag.model.ModelProviderConfig>> getConfigs() {
        return ResponseEntity.ok(modelService.getAllConfigs());
    }

    @PostMapping("/provider")
    public ResponseEntity<String> configureProvider(@RequestBody ProviderConfigRequest request) {
        modelService.updateConfig(request.getProvider(), request.getApiKey(), request.getDefaultModel(), request.isActive());
        return ResponseEntity.ok("Provider " + request.getProvider() + " configured successfully.");
    }

    @Data
    public static class ProviderConfigRequest {
        private String provider;
        private String apiKey;
        private String defaultModel;
        private boolean active;
    }
}
