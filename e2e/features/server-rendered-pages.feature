Feature: Server-rendered pages
  A page the server rendered becomes interactive without fetching its data a second time, while moving on
  to another page still fetches that page's data.

  Background:
    Given I am a visitor

  Scenario: A server-rendered page does not fetch its data again
    Given a church with full details is listed in the directory
    When I open the results for that church and the page becomes interactive
    Then the page has not asked the directory for anything

  Scenario: Moving to another page fetches that page's data
    Given a church with full details is listed in the directory
    And I have opened the results for that church and the page has become interactive
    When I open that church from the results
    Then the page has asked the directory for that church
