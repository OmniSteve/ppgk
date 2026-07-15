/**
 * GET /api/store/settings — the safe, public subset of store settings a
 * shopper needs before/during checkout (delivery fee, collection info, tax
 * treatment). Never exposes anything beyond this fixed set.
 */
import { getStoreSettings } from '../../lib/store.js';
import { ok } from '../../lib/validate.js';

export async function handleStorePublicSettings(request, env) {
  const settings = await getStoreSettings(env);
  return ok({
    storeEnabled: settings.store_enabled,
    storeCurrency: settings.store_currency,
    deliveryEnabled: settings.delivery_enabled,
    collectionEnabled: settings.collection_enabled,
    deliveryFee: settings.store_delivery_fee,
    freeDeliveryThreshold: settings.store_free_delivery_threshold,
    collectionLocationName: settings.collection_location_name,
    collectionAddress: settings.collection_address,
    collectionMapLink: settings.collection_map_link,
    collectionInstructions: settings.collection_instructions,
    collectionHours: settings.collection_hours,
    taxMode: settings.store_tax_mode,
    taxRate: settings.store_tax_rate,
  });
}
