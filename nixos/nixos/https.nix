{
  security.acme = {
    acceptTerms = true;
    defaults.email = "your@email.com";
  };

  security.acme.certs."finanzquest.app" = {
    domain = "finanzquest.app";
    extraDomainNames = [ "www.finanzquest.app" ];
  };
}
