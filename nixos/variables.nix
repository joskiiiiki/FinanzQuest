{ config, ... }: {
  imports = [ ./nixos/variables-config.nix ];

  config.var = {
    hostname = "nixos";
    username = "admin";
    configDirectory = "/home/" + config.var.username
      + "/planbackend/nixos"; # The path of the nixos configuration directory

    keyboardLayout = "de";

    location = "Berlin";
    timeZone = "Europe/Berlin";
    defaultLocale = "en_US.UTF-8";
    extraLocale = "de_DE.UTF-8";
    autoUpgrade = false;
    autoGarbageCollector = false;
  };
}
