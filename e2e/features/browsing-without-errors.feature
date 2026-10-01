Feature: Browsing without errors
  Moving between pages never raises a script error, signed in or not.

  Scenario: A visitor moves between pages without errors
    Given a church with full details is listed in the directory
    And I am a visitor
    When I go from the home page to that church's page
    Then the page raises no script error

  Scenario: A member moves between pages without errors
    Given a church with full details is listed in the directory
    And I am a signed-in member
    When I go from the home page to that church's page
    Then the page raises no script error
