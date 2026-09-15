package com.example.hello;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/photos")
public class PhotoController {

    private static final long MAX_UPLOAD_BYTES = 8L * 1024 * 1024; // 8MB incoming
    private static final int MAX_DIMENSION = 1600; // px, longest side after resize
    private static final int MAX_STORED_PHOTOS = 15; // cap in-memory gallery

    private final Map<String, StoredPhoto> photos = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<String> order = new CopyOnWriteArrayList<>(); // newest first

    @PostMapping
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Файл пуст"));
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Можно загружать только изображения"));
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            return ResponseEntity.badRequest().body(Map.of("error", "Файл слишком большой (максимум 8 МБ)"));
        }

        try {
            byte[] original = file.getBytes();
            ProcessedImage processed = resizeIfNeeded(original);

            String id = UUID.randomUUID().toString();
            photos.put(id, new StoredPhoto(processed.data(), processed.contentType(), Instant.now()));
            order.add(0, id);

            while (order.size() > MAX_STORED_PHOTOS) {
                String removedId = order.remove(order.size() - 1);
                photos.remove(removedId);
            }

            return ResponseEntity.ok(new PhotoMeta(id, "/api/photos/" + id, Instant.now()));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Не удалось обработать файл"));
        }
    }

    @GetMapping
    public List<PhotoMeta> list() {
        return order.stream()
                .map(id -> {
                    StoredPhoto p = photos.get(id);
                    return p == null ? null : new PhotoMeta(id, "/api/photos/" + id, p.uploadedAt());
                })
                .filter(m -> m != null)
                .toList();
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> get(@PathVariable String id) {
        StoredPhoto p = photos.get(id);
        if (p == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(p.contentType()))
                .body(p.data());
    }

    private ProcessedImage resizeIfNeeded(byte[] original) {
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(original));
            if (img == null) {
                return new ProcessedImage(original, "application/octet-stream");
            }
            int w = img.getWidth();
            int h = img.getHeight();
            if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
                // Re-encode as JPEG anyway to keep memory predictable, unless already small
                if (original.length <= 1024 * 1024) {
                    return new ProcessedImage(original, guessContentType(img));
                }
            }
            double scale = Math.min(1.0, (double) MAX_DIMENSION / Math.max(w, h));
            int newW = Math.max(1, (int) Math.round(w * scale));
            int newH = Math.max(1, (int) Math.round(h * scale));

            BufferedImage resized = new BufferedImage(newW, newH, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = resized.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(img, 0, 0, newW, newH, null);
            g.dispose();

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(resized, "jpg", out);
            return new ProcessedImage(out.toByteArray(), "image/jpeg");
        } catch (Exception e) {
            return new ProcessedImage(original, "application/octet-stream");
        }
    }

    private String guessContentType(BufferedImage img) {
        return img.getColorModel().hasAlpha() ? "image/png" : "image/jpeg";
    }

    public record PhotoMeta(String id, String url, Instant uploadedAt) {
    }

    private record StoredPhoto(byte[] data, String contentType, Instant uploadedAt) {
    }

    private record ProcessedImage(byte[] data, String contentType) {
    }
}
