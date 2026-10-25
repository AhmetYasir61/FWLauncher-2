<?php
  define("__DR__", $_SERVER["DOCUMENT_ROOT"]);
  require_once(__DR__."/main/includes/php/config.php");

  $searchSettings = $db->prepare("SELECT * FROM settings WHERE id = ?");
  $searchSettings->execute(array(0));
  $readSettings = $searchSettings->fetch();

  function get($parameter) {
    return strip_tags(trim(addslashes($_GET[$parameter])));
  }
  function controlSHA256($password, $realPassword)
  {
      global $db, $readSettings;
      if ($readSettings["passwordHash"] == "0") {
        $parts = explode("\$", $realPassword);
        $salt = $parts[2];
        $hash = hash("sha256", hash("sha256", $password) . $salt);
        $hash = "\$SHA\$" . $salt . "\$" . $hash;
        return $hash == $realPassword ? "OK" : "NO";
      } else if ($readSettings["passwordHash"] == "1") {
        $md5Password = md5($password);
        if ($realPassword == $md5Password) {
          return "OK";
        } else {
          return "NO";
        }
      } else if ($readSettings["passwordHash"] == "2") {
        if (password_verify($password, $realPassword)) {
          return "OK";
        } else {
          return "NO";
        }
      }
  }
?>