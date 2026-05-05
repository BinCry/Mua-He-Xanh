<?php
namespace App\Models;

use App\Core\Model;

class JourneyStop extends Model
{
    protected string $table = 'journey_stops';

    public function getByJourney(string $journeyId): array
    {
        return $this->findWhere(['journey_id' => $journeyId], 'stop_order ASC');
    }

    public function markCompleted(string $id): bool
    {
        return $this->update($id, ['is_completed' => 1, 'completed_at' => date('Y-m-d H:i:s')]);
    }

    public function getProgress(string $journeyId): array
    {
        $stops = $this->getByJourney($journeyId);
        $completed = count(array_filter($stops, fn($s) => $s['is_completed']));
        return ['completed' => $completed, 'total' => count($stops)];
    }
}
