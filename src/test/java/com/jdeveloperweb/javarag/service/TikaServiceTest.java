package com.jdeveloperweb.javarag.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TikaServiceTest {

    private TikaService tikaService;

    @BeforeEach
    void setUp() {
        tikaService = new TikaService();
    }

    @Test
    void extractText_Success() {
        // Arrange
        String content = "Hello, world! This is a test file.";
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "test.txt",
                "text/plain",
                content.getBytes()
        );

        // Act
        String result = tikaService.extractText(file);

        // Assert
        assertNotNull(result);
        assertTrue(result.contains("Hello, world!"));
    }

    @Test
    void extractText_ThrowsExceptionOnFailure() throws IOException {
        // Arrange
        MultipartFile mockFile = mock(MultipartFile.class);
        when(mockFile.getOriginalFilename()).thenReturn("error.txt");
        when(mockFile.getInputStream()).thenThrow(new IOException("Test exception"));

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            tikaService.extractText(mockFile);
        });

        assertTrue(exception.getMessage().contains("Failed to extract text from file: error.txt"));
        assertEquals(IOException.class, exception.getCause().getClass());
    }
}
