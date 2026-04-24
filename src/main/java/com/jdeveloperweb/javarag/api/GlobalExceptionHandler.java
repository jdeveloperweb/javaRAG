package com.jdeveloperweb.javarag.api;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
@lombok.extern.slf4j.Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<String> handleRuntimeException(RuntimeException e) {
        log.error("❌ [ERROR] Runtime Exception: {}", e.getMessage(), e);
        return ResponseEntity.internalServerError().body("Error: " + e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleIllegalArgumentException(IllegalArgumentException e) {
        log.warn("⚠️ [WARN] Invalid Argument: {}", e.getMessage());
        return ResponseEntity.badRequest().body("Invalid argument: " + e.getMessage());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<String> handleGeneralException(Exception e) {
        log.error("💥 [FATAL] Unexpected error: {}", e.getMessage(), e);
        return ResponseEntity.internalServerError().body("Fatal error: " + e.getMessage());
    }
}
