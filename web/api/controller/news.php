<?php
  define("__DR__", $_SERVER["DOCUMENT_ROOT"]);
  require_once(__DR__."/api/config/init.php");

  if(get("apiKey") == $readSettings["apiKey"]) {
    if (get("action") == "news") {
      $size = ((isset($_GET["size"])) ? get("size") : "5");
      $searchNews = $db->query("SELECT * FROM newsList ORDER BY id DESC LIMIT $size");
      if ($searchNews->rowCount() > 0) {
        $data = array();
        foreach($searchNews as $readNews) {
          array_push($data, array(
            "newsID" => $searchNews["id"],
            "title" => $searchNews["title"],
            "image" => $searchNews["image"],
            "text" => $searchNews["text"],
            "views" => $searchNews["newsDisplay"],
            "likes" => $searchNews["newsHearts"],
            "author" => $searchNews["newsAuthor"],
            "date" => $searchNews["date"]
          ));
        }
        exit(json_encode($data));
      } else {
        exit("Data not found.");
      }
    }
  }
?>