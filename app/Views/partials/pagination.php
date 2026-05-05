<?php /** Pagination partial — Bootstrap 5 Style */ ?>
<?php if (isset($pagination) && $pagination['total_pages'] > 1): ?>
<nav aria-label="Phân trang">
  <ul class="pagination justify-content-center">
    <?php
      $p = $pagination;
      $base = $paginationUrl ?? '';
      $sep = strpos($base, '?') !== false ? '&' : '?';
    ?>

    <!-- Prev -->
    <li class="page-item <?= ($p['current_page'] <= 1) ? 'disabled' : '' ?>">
      <a class="page-link" href="<?= $base . $sep ?>page=<?= $p['current_page'] - 1 ?>" aria-label="Previous">
        <span aria-hidden="true">&laquo;</span>
      </a>
    </li>

    <!-- Page numbers -->
    <?php for ($i = 1; $i <= $p['total_pages']; $i++): ?>
      <li class="page-item <?= ($i == $p['current_page']) ? 'active' : '' ?>">
        <a class="page-link" href="<?= $base . $sep ?>page=<?= $i ?>"><?= $i ?></a>
      </li>
    <?php endfor; ?>

    <!-- Next -->
    <li class="page-item <?= ($p['current_page'] >= $p['total_pages']) ? 'disabled' : '' ?>">
      <a class="page-link" href="<?= $base . $sep ?>page=<?= $p['current_page'] + 1 ?>" aria-label="Next">
        <span aria-hidden="true">&raquo;</span>
      </a>
    </li>
  </ul>
</nav>

<style>
.pagination .page-link {
    color: var(--color-primary);
    border-color: var(--color-border);
}
.pagination .page-item.active .page-link {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
}
</style>
<?php endif; ?>
