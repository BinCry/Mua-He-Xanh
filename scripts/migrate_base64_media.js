/*
 * Convert legacy database data:image values into durable WebP files.
 *
 * Safe usage on VPS:
 *   node scripts/migrate_base64_media.js --dry-run
 *   node scripts/migrate_base64_media.js --apply --backup-dir /home/azureuser/backups/binh-loi-media-YYYYMMDD
 *   node scripts/migrate_base64_media.js --restore /home/azureuser/backups/.../manifest.json
 */
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const db = require('../src/core/database');

const args = new Set(process.argv.slice(2));
const getArg = name => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : null;
};
const apply = args.has('--apply');
const dryRun = args.has('--dry-run') || !apply;
const restoreFile = getArg('--restore');
const backupDir = getArg('--backup-dir') || process.env.MEDIA_MIGRATION_BACKUP_DIR;
const mediaRoot = path.join(__dirname, '..', 'public', 'uploads', 'media', 'migrated');
const thumbRoot = path.join(mediaRoot, 'thumbs');

const targets = [
    { table: 'destinations', key: 'id', columns: ['cover_image', 'banner_image', 'gallery'] },
    { table: 'users', key: 'id', columns: ['avatar'] },
    { table: 'reviews', key: 'id', columns: ['images'] },
    { table: 'hero_posters', key: 'id', columns: ['image_url'] },
    { table: 'events', key: 'id', columns: ['image', 'banner_image'] },
    { table: 'video_templates', key: 'id', columns: ['cover_image'] },
    { table: 'settings', key: 'key_name', columns: ['key_value'], where: "key_name = 'brand_logo'" }
];

function isDataImage(value) {
    return typeof value === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value.trim());
}

function parseDataImage(value) {
    const match = String(value).trim().match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);
    if (!match) throw new Error('Invalid image data URI');
    return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
}

async function fileIsValid(file) {
    try {
        const meta = await sharp(file).metadata();
        return Boolean(meta.width && meta.height);
    } catch {
        return false;
    }
}

async function writeImage(value) {
    if (!isDataImage(value)) return value;
    const { buffer } = parseDataImage(value);
    if (!buffer.length) throw new Error('Decoded image is empty');

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const filename = `${hash}.webp`;
    const thumbnailName = `${hash}-640.webp`;
    const output = path.join(mediaRoot, filename);
    const thumbnail = path.join(thumbRoot, thumbnailName);

    if (dryRun) return `/uploads/media/migrated/${filename}`;

    await fs.mkdir(mediaRoot, { recursive: true, mode: 0o755 });
    await fs.mkdir(thumbRoot, { recursive: true, mode: 0o755 });

    if (!(await fileIsValid(output))) {
        const source = sharp(buffer, { failOn: 'error' }).rotate();
        const metadata = await source.metadata();
        await source
            .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
            .webp(metadata.hasAlpha ? { lossless: true } : { quality: 88 })
            .toFile(output);
    }

    if (!(await fileIsValid(thumbnail))) {
        await sharp(output)
            .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(thumbnail);
    }

    return `/uploads/media/migrated/${filename}`;
}

async function migrateStructuredValue(value, convertImage) {
    let changed = false;
    const convert = async item => {
        if (isDataImage(item)) {
            changed = true;
            return convertImage(item);
        }
        if (Array.isArray(item)) return Promise.all(item.map(convert));
        if (item && typeof item === 'object') {
            const migrated = {};
            for (const [key, child] of Object.entries(item)) migrated[key] = await convert(child);
            return migrated;
        }
        return item;
    };
    const migratedValue = await convert(value);
    return { changed, value: migratedValue };
}

async function migrateValue(value, convertImage = writeImage) {
    if (isDataImage(value)) return convertImage(value);

    // pg returns json/jsonb columns as native arrays or objects. Keep that type so
    // parameter binding persists valid JSON instead of silently skipping legacy media.
    if (Array.isArray(value) || (value && typeof value === 'object')) {
        const migrated = await migrateStructuredValue(value, convertImage);
        return migrated.changed ? migrated.value : value;
    }

    if (typeof value !== 'string' || !/data:image\//i.test(value)) return value;

    const trimmed = value.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return value;
    try {
        const parsed = JSON.parse(trimmed);
        const migrated = await migrateStructuredValue(parsed, convertImage);
        return migrated.changed ? JSON.stringify(migrated.value) : value;
    } catch {
        return value;
    }
}

async function saveManifest(manifest) {
    if (!backupDir) throw new Error('--backup-dir or MEDIA_MIGRATION_BACKUP_DIR is required for --apply');
    await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
    const manifestFile = path.join(backupDir, 'manifest.json');
    await fs.writeFile(manifestFile, JSON.stringify(manifest), { mode: 0o600 });
    await fs.chmod(manifestFile, 0o600);
    return manifestFile;
}

function toDatabaseValue(value) {
    return value && typeof value === 'object' ? JSON.stringify(value) : value;
}

async function restore() {
    if (!restoreFile) return false;
    const manifest = JSON.parse(await fs.readFile(restoreFile, 'utf8'));
    if (!Array.isArray(manifest.changes)) throw new Error('Invalid migration manifest');
    for (const change of manifest.changes) {
        await db.query(`UPDATE ${change.table} SET ${change.column} = $1 WHERE ${change.key} = $2`, [toDatabaseValue(change.before), change.id]);
    }
    console.log(`Restored ${manifest.changes.length} database values from manifest.`);
    return true;
}

async function main() {
    if (await restore()) return;
    const manifest = { createdAt: new Date().toISOString(), changes: [] };
    if (apply) await saveManifest(manifest);
    let changed = 0;

    for (const target of targets) {
        const columns = [target.key, ...target.columns].join(', ');
        let rows;
        try {
            [rows] = await db.query(`SELECT ${columns} FROM ${target.table}${target.where ? ` WHERE ${target.where}` : ''}`);
        } catch (error) {
            // Older deployments may not have every optional content table yet.
            if (error.code === '42P01' || error.code === '42703') {
                console.log(`[skip] ${target.table}: ${error.code === '42P01' ? 'table does not exist' : 'column does not exist'}`);
                continue;
            }
            throw error;
        }
        for (const row of rows) {
            for (const column of target.columns) {
                const before = row[column];
                const after = await migrateValue(before);
                if (after === before) continue;
                changed += 1;
                console.log(`${dryRun ? '[dry-run]' : '[apply]'} ${target.table}.${column} for ${row[target.key]}`);
                if (apply) {
                    manifest.changes.push({ table: target.table, key: target.key, id: row[target.key], column, before, after });
                    // Persist rollback data before mutating the corresponding DB field.
                    await saveManifest(manifest);
                    await db.query(`UPDATE ${target.table} SET ${column} = $1 WHERE ${target.key} = $2`, [toDatabaseValue(after), row[target.key]]);
                }
            }
        }
    }

    if (apply) console.log(`Migration complete: ${changed} values. Rollback manifest: ${await saveManifest(manifest)}`);
    else console.log(`Dry run complete: ${changed} values would be migrated. No database or media files were changed.`);
}

if (require.main === module) {
    main()
        .catch(error => {
            console.error('Base64 media migration failed:', error.message);
            process.exitCode = 1;
        })
        .finally(async () => {
            await db.close().catch(() => {});
        });
}

module.exports = { isDataImage, migrateValue, toDatabaseValue };
