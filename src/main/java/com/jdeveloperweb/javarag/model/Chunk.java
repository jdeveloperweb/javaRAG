package com.jdeveloperweb.javarag.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "chunks")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Chunk {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "document_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Document document;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String text;

    private Integer ordinal;

    private Integer pageNumber;

    private String chunkExternalId; // ID reference in the vector store
}
