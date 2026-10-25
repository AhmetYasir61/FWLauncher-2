<?php
  define("__DR__", $_SERVER["DOCUMENT_ROOT"]);
  require_once(__DR__."/api/config/init.php");

  if(get("apiKey") == $readSettings["apiKey"]) {
    if (get("action") == "history") {
      $size = ((isset($_GET["size"])) ? get("size") : "5");
      if (get("username") !== "") {
        $searchStoreHistory = $db->prepare("SELECT * FROM storeHistory WHERE username = ? ORDER BY id DESC LIMIT $size");
        $searchStoreHistory->execute(array(get("username")));
      } else {
        $searchStoreHistory = $db->query("SELECT * FROM storeHistory ORDER BY id DESC LIMIT $size");
      }
      if ($searchStoreHistory->rowCount() > 0) {
        $data = array();
        foreach($searchStoreHistory as $readStoreHistory) {
          $searchServer = $db->prepare("SELECT * FROM serverList WHERE id = ?");
          $searchServer->execute(array($readStoreHistory["serverID"]));
          if ($searchServer->rowCount() > 0) {
            $readServer = $searchServer->fetch();
            array_push($data, array(
              "username" => $readStoreHistory["username"],
              "productName" => $readStoreHistory["productName"],
              "productPrice" => $readStoreHistory["productPrice"],
              "serverName" => $readServer["name"],
              "date" => $readStoreHistory["date"]
            ));
          }
        }
        exit(json_encode($data));
      } else {
        exit("Data not found.");
      }
    }
  }
?>