/*
# Update VAPID keys with correct raw public key format

The previous VAPID public key was stored in SPKI DER format (91 bytes base64url-encoded),
but the Web Push API requires the raw 65-byte uncompressed P-256 public key.
This migration updates both keys with correctly formatted values.
*/

UPDATE business_config
SET vapid_public_key = 'BFEkcoEyDKtaRO_XMpt-YmrsIV4PIbZKvuq9btWXUv5cdzilEhLLyRDEc7zVl6xc4kzSM0g1zyTK9ZkvMVIvJ4U',
    vapid_private_key = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgvnHaAGUALBzCQYaW3cR7Q-GMAcu_SLWmOzbANy_M7--hRANCAARRJHKBMgyrWkTv1zKbfmJq7CFeDyG2Sr7qvW7Vl1L-XHc4pRISy8kQxHO81ZesXOJM0jNINc8kyvWZLzFSLyeF'
WHERE id = 1;