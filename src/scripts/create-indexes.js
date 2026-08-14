const db = require('../core/database');

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_destinations_slug ON destinations(slug);",
  "CREATE INDEX IF NOT EXISTS idx_destinations_active_sort ON destinations(is_active, sort_order);",
  "CREATE INDEX IF NOT EXISTS idx_user_sessions_uuid ON user_sessions(uuid);",
  "CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_messages_sender_uuid ON messages(sender_uuid, created_at);",
  "CREATE INDEX IF NOT EXISTS idx_messages_receiver_uuid ON messages(receiver_uuid, created_at);",
  "CREATE INDEX IF NOT EXISTS idx_messages_dest_id ON messages(destination_id, created_at);",
  "CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);",
  "CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_review_likes_review_id ON review_likes(review_id, user_id);",
  "CREATE INDEX IF NOT EXISTS idx_review_likes_review_guest ON review_likes(review_id, guest_uuid);",
  "CREATE INDEX IF NOT EXISTS idx_review_comments_review_id ON review_comments(review_id, created_at);",
  "CREATE INDEX IF NOT EXISTS idx_checkins_dest_session ON check_ins(destination_id, session_id);",
  "CREATE INDEX IF NOT EXISTS idx_checkins_created_at ON check_ins(created_at);",
  "CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics(session_id);",
  "CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics(created_at);",
  "CREATE INDEX IF NOT EXISTS idx_analytics_page_url ON analytics(page_url);",
  "CREATE INDEX IF NOT EXISTS idx_journeys_session_status ON journeys(session_id, status);",
  "CREATE INDEX IF NOT EXISTS idx_journey_stops_journey ON journey_stops(journey_id, stop_order);",
  "CREATE INDEX IF NOT EXISTS idx_user_badges_session ON user_badges(session_id, badge_id);",
  "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
  "CREATE INDEX IF NOT EXISTS idx_destination_likes_dest_user ON destination_likes(destination_id, user_id);",
  "CREATE INDEX IF NOT EXISTS idx_user_favorites_dest_user ON user_favorites(destination_id, user_id);"
];

async function createIndexes() {
  console.log('Starting index creation...');
  for (const query of indexes) {
    try {
      await db.query(query);
      console.log(`SUCCESS: ${query}`);
    } catch (error) {
      console.error(`FAILED: ${query}`);
      console.error(error.message);
    }
  }
  console.log('Finished creating indexes.');
  process.exit(0);
}

createIndexes();
