package com.jdeveloperweb.javarag.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "model_provider_configs")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ModelProviderConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String providerName; // e.g., "OPENAI", "ANTHROPIC"

    @Column(nullable = false)
    private String apiKey;

    private String defaultModelName;
    
    @Builder.Default
    private Boolean isActive = false;

    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
