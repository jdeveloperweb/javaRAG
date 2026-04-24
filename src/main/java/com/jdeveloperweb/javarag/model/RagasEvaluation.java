package com.jdeveloperweb.javarag.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "ragas_evaluations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class RagasEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id")
    private RagasTestCase testCase;

    @Column(columnDefinition = "TEXT")
    private String question;

    @Column(columnDefinition = "TEXT")
    private String generatedAnswer;

    @Column(columnDefinition = "TEXT")
    private String contextUsed;

    private Double faithfulnessScore;
    private Double answerRelevancyScore;
    private Double contextPrecisionScore;
    private Double contextRecallScore;
    private Double overallScore;

    private String provider;
    private Long evaluationTimeMillis;

    @Column(columnDefinition = "TEXT")
    private String evaluationDetailsJson; // JSON breakdown of claims/verifications

    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
