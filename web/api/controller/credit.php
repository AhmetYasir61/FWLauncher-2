<?php
  define("__DR__", $_SERVER["DOCUMENT_ROOT"]);
  require_once(__DR__."/api/config/init.php");

  if(get("apiKey") == $readSettings["apiKey"]) {
    if (get("action") == "history") {
      $size = ((isset($_GET["size"])) ? get("size") : "5");
      if (get("username") !== "") {
        $searchCreditHistory = $db->prepare("SELECT * FROM creditHistory WHERE username = ? AND type = ? ORDER BY id DESC LIMIT $size");
        $searchCreditHistory->execute(array(get("username"), 0));
      } else {
        $searchCreditHistory = $db->prepare("SELECT * FROM creditHistory WHERE type = ? ORDER BY id DESC LIMIT $size");
        $searchCreditHistory->execute(array(0));
      }
      if ($searchCreditHistory->rowCount() > 0) {
        $data = array();
        foreach($searchCreditHistory as $readCreditHistory) {
          array_push($data, array(
            "username" => $readCreditHistory["username"],
            "method" => (($readCreditHistory["method"] == "0") ? "Mobile" : "Credit Card"),
            "amount" => $readCreditHistory["amount"],
            "timeStamp" => $readCreditHistory["timeStamp"],
            "date" => $readCreditHistory["date"]
          ));
        }
        exit(json_encode($data));
      } else {
        exit("Data not found.");
      }
    } else if (get("action") == "top") {
      if (get("type") == "all") {
        $topCreditHistory = $db->prepare("SELECT SUM(ch.amount) as totalAmount, COUNT(ch.id) as totalTransaction, ac.username FROM creditHistory ch INNER JOIN accounts ac ON ch.username = ac.username WHERE ch.type = ? GROUP BY ch.username HAVING totalTransaction > 0 ORDER BY totalAmount DESC LIMIT $size");
        $topCreditHistory->execute(array(0));
      } else if (get("type") == "justMonth") {
        $topCreditHistory = $db->prepare("SELECT SUM(ch.amount) as totalAmount, COUNT(ch.id) as totalTransaction, ac.username FROM creditHistory ch INNER JOIN accounts ac ON ch.username = ac.username WHERE ch.type = ? AND ch.date LIKE ? GROUP BY ch.username HAVING totalTransaction > 0 ORDER BY totalAmount DESC LIMIT $size");
        $topCreditHistory->execute(array(0, '%'.date("m.Y").'%'));
      }
      if ($topCreditHistory->rowCount() > 0) {
        $data = array();
        foreach($topCreditHistory as $readTopCreditHistory) {
          array_push($data, array(
            "username" => $readTopCreditHistory["username"],
            "transactionCount" => $readTopCreditHistory["totalTransaction"],
            "amount" => $readTopCreditHistory["totalAmount"]
          ));
        }
        exit(json_encode($data));
      } else {
        exit("Data not found.");
      }
    }
  }
?>