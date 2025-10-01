#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>
#include <string.h>
#include <emscripten/emscripten.h>
#include "falcon/falcon.h"
#include "falcon/deterministic.h"

#define SK_SIZE FALCON_DET1024_PRIVKEY_SIZE
#define PK_SIZE FALCON_DET1024_PUBKEY_SIZE
#define SIG_COMPRESSED_MAX_SIZE FALCON_DET1024_SIG_COMPRESSED_MAXSIZE
#define SIG_CT_SIZE FALCON_DET1024_SIG_CT_SIZE

EMSCRIPTEN_KEEPALIVE
int get_sk_size() { return SK_SIZE; }

EMSCRIPTEN_KEEPALIVE
int get_pk_size() { return PK_SIZE; }

EMSCRIPTEN_KEEPALIVE
int get_sig_compressed_max_size() { return SIG_COMPRESSED_MAX_SIZE; }

EMSCRIPTEN_KEEPALIVE
int get_sig_ct_size() { return SIG_CT_SIZE; }

EMSCRIPTEN_KEEPALIVE
int falcon_det1024_keygen_wrapper(uint8_t *sk, uint8_t *pk) {
    shake256_context rng;
    
    // Use a random seed based on system time and pointer values for entropy
    uint8_t seed[48];
    
    // Mix in the current time, pointers, and other sources of entropy
    for (int i = 0; i < 16; i++) {
        uint64_t v = (uint64_t)&seed ^ (uint64_t)time(NULL) ^ (uint64_t)clock();
        v += (uint64_t)rand() << 32;
        memcpy(seed + i*3, &v, 3);
    }
    
    // Initialize RNG with the random seed
    shake256_init_prng_from_seed(&rng, seed, sizeof(seed));
    
    int r = falcon_det1024_keygen(&rng, sk, pk);
    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] keygen failed: %d\n", r);
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE
int falcon_det1024_sign_compressed_wrapper(uint8_t *sig, size_t *sig_len,
                const uint8_t *sk, const uint8_t *msg, size_t msg_len) {
    int r;
    
    // Print debug info
    printf("[falcon_wrapper] falcon_det1024_sign_compressed_wrapper called with:\n");
    printf("  - sig: %p\n", (void*)sig);
    printf("  - sig_len: %p (value: %zu)\n", (void*)sig_len, *sig_len);
    printf("  - sk: %p\n", (void*)sk);
    printf("  - msg: %p\n", (void*)msg);
    printf("  - msg_len: %zu\n", msg_len);

    // Verify input parameters
    if (!sig || !sig_len || !sk || (!msg && msg_len > 0)) {
        fprintf(stderr, "[falcon_wrapper] Invalid input parameters\n");
        return -1;
    }

    // Ensure the buffer is large enough
    if (*sig_len < SIG_COMPRESSED_MAX_SIZE) {
        fprintf(stderr, "[falcon_wrapper] Signature buffer too small\n");
        return -2;
    }

    // Allocate a temporary buffer for the SHAKE256 context
    shake256_context *detrng = malloc(sizeof(shake256_context));
    if (!detrng) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for detrng\n");
        return -100;
    }
    
    shake256_context *hd = malloc(sizeof(shake256_context));
    if (!hd) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for hd\n");
        free(detrng);
        return -100;
    }
    
    // Allocate temporary buffer for sign dynamic operations
    size_t tmpsd_size = FALCON_TMPSIZE_SIGNDYN(FALCON_DET1024_LOGN);
    uint8_t *tmpsd = malloc(tmpsd_size);
    if (!tmpsd) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for tmpsd\n");
        free(detrng);
        free(hd);
        return -100;
    }
    
    // Logn and salt
    uint8_t logn[1] = {FALCON_DET1024_LOGN};
    uint8_t *salt = malloc(40);
    if (!salt) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for salt\n");
        free(detrng);
        free(hd);
        free(tmpsd);
        return -100;
    }
    
    // Allocate buffer for the salted signature
    size_t saltedsig_len = FALCON_SIG_COMPRESSED_MAXSIZE(FALCON_DET1024_LOGN);
    uint8_t *saltedsig = malloc(saltedsig_len);
    if (!saltedsig) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for saltedsig\n");
        free(detrng);
        free(hd);
        free(tmpsd);
        free(salt);
        return -100;
    }
    
    // Check if the private key has the correct logn value
    if (falcon_get_logn(sk, SK_SIZE) != FALCON_DET1024_LOGN) {
        fprintf(stderr, "[falcon_wrapper] Invalid private key format\n");
        free(detrng);
        free(hd);
        free(tmpsd);
        free(salt);
        free(saltedsig);
        return FALCON_ERR_FORMAT;
    }
    
    // SHAKE(logn || privkey || data), set to output mode.
    shake256_init(detrng);
    shake256_inject(detrng, logn, 1);
    shake256_inject(detrng, sk, SK_SIZE);
    shake256_inject(detrng, msg, msg_len);
    shake256_flip(detrng);
    
    // Write the salt
    salt[0] = FALCON_DET1024_CURRENT_SALT_VERSION;
    salt[1] = FALCON_DET1024_LOGN;
    memcpy(salt+2, "FALCON_DET", 10);
    // Fill the rest with zeros
    memset(salt+12, 0, 28);
    
    // SHAKE(salt || data), still in input mode.
    shake256_init(hd);
    shake256_inject(hd, salt, 40);
    shake256_inject(hd, msg, msg_len);
    
    // Sign using the private key
    r = falcon_sign_dyn_finish(detrng, saltedsig, &saltedsig_len,
        FALCON_SIG_COMPRESSED, sk, SK_SIZE,
        hd, salt, tmpsd, tmpsd_size);
    
    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] sign_dyn_finish failed: %d\n", r);
        free(detrng);
        free(hd);
        free(tmpsd);
        free(salt);
        free(saltedsig);
        return r;
    }
    
    // Transform the salted signature to unsalted format
    sig[0] = saltedsig[0] | 0x80;
    sig[1] = FALCON_DET1024_CURRENT_SALT_VERSION;
    memcpy(sig+2, saltedsig+41, saltedsig_len-41);
    
    *sig_len = saltedsig_len-40+1;
    
    printf("[falcon_wrapper] Signature generated successfully, length: %zu\n", *sig_len);
    
    // Free all allocated memory
    free(detrng);
    free(hd);
    free(tmpsd);
    free(salt);
    free(saltedsig);
    
    return 0;
}

EMSCRIPTEN_KEEPALIVE
int falcon_det1024_convert_compressed_to_ct_wrapper(uint8_t *sig_ct,
                const uint8_t *sig_compressed, size_t sig_compressed_len) {
    // Print debug info
    printf("[falcon_wrapper] falcon_det1024_convert_compressed_to_ct_wrapper called with:\n");
    printf("  - sig_ct: %p\n", (void*)sig_ct);
    printf("  - sig_compressed: %p\n", (void*)sig_compressed);
    printf("  - sig_compressed_len: %zu\n", sig_compressed_len);

    // Verify input parameters
    if (!sig_ct || !sig_compressed) {
        fprintf(stderr, "[falcon_wrapper] Invalid input parameters\n");
        return -1;
    }

    int r = falcon_det1024_convert_compressed_to_ct(sig_ct, sig_compressed, sig_compressed_len);

    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] convert_compressed_to_ct failed: %d\n", r);
    } else {
        printf("[falcon_wrapper] Signature converted successfully\n");
    }
    return r;
}
EMSCRIPTEN_KEEPALIVE
int falcon_det1024_verify_compressed_wrapper(const uint8_t *sig, size_t sig_len,
                  const uint8_t *pk, const uint8_t *msg, size_t msg_len) {
    int r;
    
    // Print debug info
    printf("[falcon_wrapper] falcon_det1024_verify_compressed_wrapper called with:\n");
    printf("  - sig: %p\n", (void*)sig);
    printf("  - sig_len: %zu\n", sig_len);
    printf("  - pk: %p\n", (void*)pk);
    printf("  - msg: %p\n", (void*)msg);
    printf("  - msg_len: %zu\n", msg_len);

    // Verify input parameters
    if (!sig || !pk || (!msg && msg_len > 0)) {
        fprintf(stderr, "[falcon_wrapper] Invalid input parameters\n");
        return -1;
    }

    // Check if signature has the correct header byte
    if (sig_len < 2 || (sig[0] != FALCON_DET1024_SIG_COMPRESSED_HEADER)) {
        fprintf(stderr, "[falcon_wrapper] Invalid signature format\n");
        return FALCON_ERR_BADSIG;
    }

    // Allocate temporary buffer for verification
    uint8_t *tmpvv = malloc(FALCON_TMPSIZE_VERIFY(FALCON_DET1024_LOGN));
    if (!tmpvv) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for tmpvv\n");
        return -100;
    }

    // Allocate and prepare the salted signature
    uint8_t *salted_sig = malloc(FALCON_SIG_COMPRESSED_MAXSIZE(FALCON_DET1024_LOGN));
    if (!salted_sig) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for salted_sig\n");
        free(tmpvv);
        return -100;
    }

    // Convert the deterministic signature to salted format
    salted_sig[0] = sig[0] & ~0x80; // Reset MSB to 0

    // Allocate and prepare the salt
    uint8_t *salt = malloc(40);
    if (!salt) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for salt\n");
        free(tmpvv);
        free(salted_sig);
        return -100;
    }

    // Write the salt
    salt[0] = sig[1]; // Salt version
    salt[1] = FALCON_DET1024_LOGN;
    memcpy(salt+2, "FALCON_DET", 10);
    memset(salt+12, 0, 28); // Fill the rest with zeros

    // Copy salt to the salted signature
    memcpy(salted_sig+1, salt, 40);

    // Copy the rest of the signature
    memcpy(salted_sig+41, sig+2, sig_len-2);

    // The salted signature is 40-1 bytes longer
    size_t salted_sig_len = sig_len + 40 - 1;

    r = falcon_verify(salted_sig, salted_sig_len, FALCON_SIG_COMPRESSED,
        pk, PK_SIZE, msg, msg_len,
        tmpvv, FALCON_TMPSIZE_VERIFY(FALCON_DET1024_LOGN));

    // Free allocated memory
    free(tmpvv);
    free(salted_sig);
    free(salt);
    
    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] verify_compressed failed: %d\n", r);
    } else {
        printf("[falcon_wrapper] Signature verified successfully\n");
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE
int falcon_det1024_verify_ct_wrapper(const uint8_t *sig,
                  const uint8_t *pk, const uint8_t *msg, size_t msg_len) {
    int r;
    
    // Print debug info
    printf("[falcon_wrapper] falcon_det1024_verify_ct_wrapper called with:\n");
    printf("  - sig: %p\n", (void*)sig);
    printf("  - pk: %p\n", (void*)pk);
    printf("  - msg: %p\n", (void*)msg);
    printf("  - msg_len: %zu\n", msg_len);

    // Verify input parameters
    if (!sig || !pk || (!msg && msg_len > 0)) {
        fprintf(stderr, "[falcon_wrapper] Invalid input parameters\n");
        return -1;
    }

    // Check if signature has the correct header byte
    if (sig[0] != FALCON_DET1024_SIG_CT_HEADER) {
        fprintf(stderr, "[falcon_wrapper] Invalid CT signature format\n");
        return FALCON_ERR_BADSIG;
    }

    // Allocate temporary buffer for verification
    uint8_t *tmpvv = malloc(FALCON_TMPSIZE_VERIFY(FALCON_DET1024_LOGN));
    if (!tmpvv) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for tmpvv\n");
        return -100;
    }

    // Allocate and prepare the salted signature
    uint8_t *salted_sig = malloc(FALCON_SIG_CT_SIZE(FALCON_DET1024_LOGN));
    if (!salted_sig) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for salted_sig\n");
        free(tmpvv);
        return -100;
    }

    // Convert the deterministic signature to salted format
    salted_sig[0] = sig[0] & ~0x80; // Reset MSB to 0

    // Allocate and prepare the salt
    uint8_t *salt = malloc(40);
    if (!salt) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for salt\n");
        free(tmpvv);
        free(salted_sig);
        return -100;
    }

    // Write the salt
    salt[0] = sig[1]; // Salt version
    salt[1] = FALCON_DET1024_LOGN;
    memcpy(salt+2, "FALCON_DET", 10);
    memset(salt+12, 0, 28); // Fill the rest with zeros

    // Copy salt to the salted signature
    memcpy(salted_sig+1, salt, 40);

    // Copy the rest of the signature
    memcpy(salted_sig+41, sig+2, SIG_CT_SIZE-2);
    
    r = falcon_verify(salted_sig, FALCON_SIG_CT_SIZE(FALCON_DET1024_LOGN), FALCON_SIG_CT,
        pk, PK_SIZE, msg, msg_len,
        tmpvv, FALCON_TMPSIZE_VERIFY(FALCON_DET1024_LOGN));

    // Free allocated memory
    free(tmpvv);
    free(salted_sig);
    free(salt);
    
    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] verify_ct failed: %d\n", r);
    } else {
        printf("[falcon_wrapper] Signature verified successfully\n");
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE
int falcon_det1024_get_salt_version_wrapper(const uint8_t *sig) {
    if (!sig) {
        fprintf(stderr, "[falcon_wrapper] Invalid input parameters\n");
        return -1;
    }
    
    return falcon_det1024_get_salt_version(sig);
}
