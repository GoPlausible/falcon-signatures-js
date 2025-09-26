#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <emscripten/emscripten.h>
#include "falcon/falcon.h"

#define LOGN 10  // Falcon-1024
#define SK_SIZE FALCON_PRIVKEY_SIZE(LOGN)
#define PK_SIZE FALCON_PUBKEY_SIZE(LOGN)
#define SIG_MAX_SIZE FALCON_SIG_COMPRESSED_MAXSIZE(LOGN)
#define TMP_KEYGEN FALCON_TMPSIZE_KEYGEN(LOGN)
#define TMP_SIGN   FALCON_TMPSIZE_SIGNDYN(LOGN)
#define TMP_VERIFY FALCON_TMPSIZE_VERIFY(LOGN)


EMSCRIPTEN_KEEPALIVE
int get_sk_size() { return SK_SIZE; }

EMSCRIPTEN_KEEPALIVE
int get_pk_size() { return PK_SIZE; }

EMSCRIPTEN_KEEPALIVE
int get_sig_max_size() { return SIG_MAX_SIZE; }

EMSCRIPTEN_KEEPALIVE
int simple_keygen(uint8_t *sk, uint8_t *pk) {
    uint8_t tmp[TMP_KEYGEN];
    shake256_context rng;
    uint8_t seed[48];
    for (int i = 0; i < 48; i++) seed[i] = (uint8_t)(i + 1);
    shake256_init_prng_from_seed(&rng, seed, sizeof(seed));

    int r = falcon_keygen_make(&rng, LOGN, sk, SK_SIZE, pk, PK_SIZE, tmp, sizeof(tmp));
    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] keygen failed: %d\n", r);
    }
    return r;
}

EMSCRIPTEN_KEEPALIVE
int simple_sign(uint8_t *sig, size_t *sig_len,
                const uint8_t *sk, const uint8_t *msg, size_t msg_len) {
    int r;

    // Print debug info
    printf("[falcon_wrapper] simple_sign called with:\n");
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

    // Allocate temp buffers on the heap instead of the stack
    size_t tmp_expand_size = FALCON_TMPSIZE_EXPANDPRIV(LOGN);
    size_t tmp_sign_size = FALCON_TMPSIZE_SIGNDYN(LOGN);
    
    uint8_t *tmp_expand = malloc(tmp_expand_size);
    if (!tmp_expand) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for tmp_expand\n");
        return -100;
    }
    
    uint8_t *tmp_sign = malloc(tmp_sign_size);
    if (!tmp_sign) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for tmp_sign\n");
        free(tmp_expand);
        return -100;
    }

    // Expanded key
    size_t exp_size = FALCON_EXPANDEDKEY_SIZE(LOGN);
    uint8_t *exp_sk = malloc(exp_size);
    if (!exp_sk) {
        fprintf(stderr, "[falcon_wrapper] malloc failed for exp_sk\n");
        free(tmp_expand);
        free(tmp_sign);
        return -100;
    }

    // Expand the private key
    r = falcon_expand_privkey(exp_sk, exp_size,
                              sk, SK_SIZE,
                              tmp_expand, tmp_expand_size);
    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] expand_privkey failed: %d\n", r);
        free(exp_sk);
        free(tmp_expand);
        free(tmp_sign);
        return r;
    }

    // Seed PRNG deterministically (for now)
    shake256_context rng;
    uint8_t seed[48];
    for (int i = 0; i < 48; i++) seed[i] = (uint8_t)(i + 42);
    shake256_init_prng_from_seed(&rng, seed, sizeof(seed));

    // Sign using expanded key
    size_t max_sig_len = *sig_len;
    printf("[falcon_wrapper] Max signature length: %zu\n", max_sig_len);
    
    r = falcon_sign_tree(&rng,
                         sig, sig_len, FALCON_SIG_COMPRESSED,
                         exp_sk,
                         msg, msg_len,
                         tmp_sign, tmp_sign_size);

    // Free all allocated memory
    free(exp_sk);
    free(tmp_expand);
    free(tmp_sign);

    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] sign failed: %d\n", r);
    } else {
        printf("[falcon_wrapper] Signature generated successfully, length: %zu\n", *sig_len);
    }
    return r;
}




EMSCRIPTEN_KEEPALIVE
int simple_verify(const uint8_t *sig, size_t sig_len,
                  const uint8_t *pk, const uint8_t *msg, size_t msg_len) {
    uint8_t tmp[TMP_VERIFY];

    int r = falcon_verify(sig, sig_len, FALCON_SIG_COMPRESSED,
                          pk, PK_SIZE, msg, msg_len,
                          tmp, sizeof(tmp));
    if (r != 0) {
        fprintf(stderr, "[falcon_wrapper] verify failed: %d\n", r);
    }
    return r;
}
