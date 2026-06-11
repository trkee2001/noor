'use strict';

(function (global) {
    const SUPABASE_URL = 'https://fdgbvwdfoqtlqgrdqkkm.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_vzX7qivLBBjHlvHwpK5Cbw_nBxL_lop';
    const TABLE_BANNER_ADS = 'banner_ads';
    const TABLE_BANNER_OVERLAY = 'banner_overlay_settings';
    const OVERLAY_ROW_ID = 1;

    const client = global.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY) ?? null;

    function mapAdToDb(ad) {
        return {
            id: String(ad.id),
            name: ad.name || '',
            image: ad.image || '',
            link_type: ad.linkType || 'join',
            link: ad.link || '#register',
            caption: ad.caption || '',
            active: ad.active !== false,
            archived: ad.archived === true,
            archived_at: ad.archivedAt || null,
            created_at: ad.createdAt || new Date().toISOString(),
            sort_order: Number.isFinite(ad.sortOrder) ? ad.sortOrder : 0
        };
    }

    function mapAdFromDb(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name || '',
            image: row.image || '',
            linkType: row.link_type || 'join',
            link: row.link || '#register',
            caption: row.caption || '',
            active: row.active !== false,
            archived: row.archived === true,
            archivedAt: row.archived_at || null,
            createdAt: row.created_at || null,
            sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : null
        };
    }

    function mapOverlayToDb(settings) {
        return {
            id: OVERLAY_ROW_ID,
            blur_amount: settings.blurAmount,
            overlay_height: settings.overlayHeight,
            overlay_color_theme: settings.overlayColorTheme,
            edge_smoothness: settings.edgeSmoothness,
            color_strength: settings.colorStrength ?? 70
        };
    }

    function mapOverlayFromDb(row) {
        if (!row) return null;
        return {
            blurAmount: row.blur_amount,
            overlayHeight: row.overlay_height,
            overlayColorTheme: row.overlay_color_theme,
            edgeSmoothness: row.edge_smoothness,
            colorStrength: Number.isFinite(row.color_strength) ? row.color_strength : 70
        };
    }

    async function fetchBannerAds() {
        if (!client) return null;

        const { data, error } = await client
            .from(TABLE_BANNER_ADS)
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('banner-store fetch ads failed:', error);
            return null;
        }

        return (data || [])
            .map(mapAdFromDb)
            .sort((a, b) => {
                const ao = Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
                const bo = Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
                if (ao !== bo) return ao - bo;
                return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
            });
    }

    function stripSortOrder(rows) {
        return rows.map((row) => {
            const copy = { ...row };
            delete copy.sort_order;
            return copy;
        });
    }

    async function upsertBannerAdRows(rows) {
        if (!rows.length) return { ok: true };

        let { error } = await client
            .from(TABLE_BANNER_ADS)
            .upsert(rows, { onConflict: 'id' });

        if (error && /sort_order/i.test(error.message || '')) {
            ({ error } = await client
                .from(TABLE_BANNER_ADS)
                .upsert(stripSortOrder(rows), { onConflict: 'id' }));
        }

        if (error) {
            console.error('banner-store upsert ads failed:', error);
            return { ok: false, reason: error.message };
        }

        return { ok: true };
    }

    async function replaceBannerAds(ads) {
        if (!client) return { ok: false, reason: 'no-client' };

        const rows = ads.map(mapAdToDb);
        const keepIds = new Set(rows.map((row) => row.id));

        const upsertResult = await upsertBannerAdRows(rows);
        if (!upsertResult.ok) return upsertResult;

        const { data: existing, error: fetchError } = await client
            .from(TABLE_BANNER_ADS)
            .select('id');

        if (fetchError) {
            console.error('banner-store fetch ids failed:', fetchError);
            return { ok: true, partial: true };
        }

        const orphanIds = (existing || [])
            .map((row) => row.id)
            .filter((id) => !keepIds.has(id));

        if (orphanIds.length) {
            const { error: deleteError } = await client
                .from(TABLE_BANNER_ADS)
                .delete()
                .in('id', orphanIds);

            if (deleteError) {
                console.error('banner-store delete orphans failed:', deleteError);
            }
        }

        return { ok: true };
    }

    async function fetchBannerOverlaySettings() {
        if (!client) return null;

        const { data, error } = await client
            .from(TABLE_BANNER_OVERLAY)
            .select('*')
            .eq('id', OVERLAY_ROW_ID)
            .maybeSingle();

        if (error) {
            console.error('banner-store fetch overlay failed:', error);
            return null;
        }

        return mapOverlayFromDb(data);
    }

    async function saveBannerOverlaySettings(settings) {
        if (!client) return { ok: false, reason: 'no-client' };

        let row = mapOverlayToDb(settings);
        let { error } = await client
            .from(TABLE_BANNER_OVERLAY)
            .upsert(row, { onConflict: 'id' });

        if (error && /color_strength/i.test(error.message || '')) {
            row = { ...row };
            delete row.color_strength;
            ({ error } = await client
                .from(TABLE_BANNER_OVERLAY)
                .upsert(row, { onConflict: 'id' }));
        }

        if (error) {
            console.error('banner-store save overlay failed:', error);
            return { ok: false, reason: error.message };
        }

        return { ok: true };
    }

    global.BannerStore = {
        isEnabled: Boolean(client),
        fetchBannerAds,
        replaceBannerAds,
        fetchBannerOverlaySettings,
        saveBannerOverlaySettings
    };
}(window));
