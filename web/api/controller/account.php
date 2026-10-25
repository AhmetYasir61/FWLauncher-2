<?php
  define("__DR__", $_SERVER["DOCUMENT_ROOT"]);
  require_once(__DR__."/api/config/init.php");

  if(get("apiKey") == $readSettings["apiKey"]) {
    if (get("action") == "password-control") {
      $searchAccounts = $db->prepare("SELECT * FROM accounts WHERE username = ?");
      $searchAccounts->execute(array(get("username")));
      if ($searchAccounts->rowCount() > 0) {
        $readAccounts = $searchAccounts->fetch();
        if (controlSHA256(get("password"), $readAccounts["password"]) == "OK") {
          exit("OK");
        } else {
          exit("NO");
        }
      }
    } else if(get("action") == "socials") {
      $searchAccounts = $db->prepare("SELECT * FROM accounts WHERE username = ?");
      $searchAccounts->execute(array(get("username")));
      if ($searchAccounts->rowCount() > 0) {
        $readAccounts = $searchAccounts->fetch();
        $data = array(
          "youtube" => $readAccounts['youtube'],
          "discord" => $readAccounts['discord'],
          "instagram" => $readAccounts['instagram'],
          "twitter" => $readAccounts['twitter'],
          "skype" => $readAccounts['skype']
        );
        exit(json_encode($data));
      } else {
        exit("Data not found.");
      }
    } else if(get("action") == "info") {
      $searchAccounts = $db->prepare("SELECT * FROM accounts WHERE username = ?");
      $searchAccounts->execute(array(get("username")));
      if ($searchAccounts->rowCount() > 0) {
        $readAccounts = $searchAccounts->fetch();
        $data = array(
          "realname" => $readAccounts['realname'],
          "username" => $readAccounts['username'],
          "credit" => $readAccounts['credit'],
          "permission" => $readAccounts['permission'],
          "lastLogin" => $readAccounts['lastLogin'],
          "imageAvatar" => $readAccounts['imageAvatar'],
          "registerDate" => $readAccounts['registerDate'],
          "socials" => array(
            "youtube" => $readAccounts['youtube'],
            "discord" => $readAccounts['discord'],
            "instagram" => $readAccounts['instagram'],
            "twitter" => $readAccounts['twitter'],
            "skype" => $readAccounts['skype']
          )
        );
        exit(json_encode($data));
      } else {
        exit("Data not found.");
      }
    }
  }
?>