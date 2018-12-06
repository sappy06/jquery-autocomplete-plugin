$( document ).ready(function() {
  $("#tagbox").tagdragon();

  $('#tagbox').on('click', 'span', function () {
      $(this).remove();
  });

  var backKeyPressed = 0;

  $("#tagbox input").on({
      keyup: function(ev) {
        if (/(13|32)/.test(ev.which) && this.value) {
          validateEmail(this.value, $("#tagbox input")) ;
        }
        if (/(8)/.test(ev.which)) {
            if (!this.value) {
                if ($('#tagbox span').last().hasClass("focusTag")) {
                  backKeyPressed++;
                  if (backKeyPressed % 2 === 0) {
                      $('#tagbox span').last().remove();
                      $('#tagbox span').last().addClass("focusTag");
                      backKeyPressed = 1;
                  }
                }
                else {
                    $('#tagbox span').last().addClass("focusTag");
                }
            }
        }
      }
  });
  
  $("#tagbox").tagdragon_configure({
    onSelectedItem: function(val) { 
      $("<span/>", { text: val.firstName + " " + val.lastName + " ("+ val.email +")", insertBefore: $("#tagbox input"), class: 'email-select', tabindex: '1' });
      $("#tagbox input").val("");
      $("#email-error").addClass("hide");
    },
    onRenderItem: function(val, index, length, filter) {
      return val.firstName + " " + val.lastName + " ("+ val.email +")";
    }
  });
});

function validateEmail(inputValue, that) {
    $("#email-error").addClass("hide");
    var emailAddresses = inputValue.replace(/\s+$/, '').split(",");
    var regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    emailAddresses.forEach(function (emailAddress) {
        if (regex.test(emailAddress)) {
            $("<span/>", { text: emailAddress.toLowerCase(), insertBefore: that, class: 'email-select', tabindex: '1' });
            that.value = "";
            $("#tagbox input").val("");
        } else {
          $("#email-error").removeClass("hide");
        }
    });
}

