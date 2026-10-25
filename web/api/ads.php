<?php
require_once "pw_common.php";
require_once "config.php";

$ads = [];
$res = mysqli_query($link,
    "SELECT id, title, description, badge, image_url, url FROM pw_ads ORDER BY sort_order ASC, id DESC");
if ($res) {
    while ($row = mysqli_fetch_assoc($res)) {
        $ads[] = [
            'id'          => (string)$row['id'],
            'title'       => $row['title'],
            'description' => $row['description'],
            'badge'       => $row['badge'],
            'imageUrl'    => $row['image_url'],
            'url'         => $row['url'],
        ];
    }
}

// Launcher bir JSON DİZİSİ bekler.
pw_json($ads);
