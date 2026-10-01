Feature: Searching for a church
  A visitor searches the directory by name, by place, and by what matters to them.

  Background:
    Given I am a visitor

  Scenario: Searching by name finds the church
    Given a church is listed in the directory
    And I am on the home page
    When I search for that church by name
    Then that church is in the results

  Scenario: Searching by state finds every church in that state
    Given two churches are listed in the same state
    And I am on the home page
    When I search for churches in that state
    Then both churches are in the results

  Scenario: Searching by worship style shows the results
    Given a church is listed in the directory
    And I am on the home page
    When I search for churches with that church's worship style
    Then I see the search results

  Scenario: Searching for wheelchair access shows the results
    Given a church is listed in the directory
    And I am on the home page
    When I search for wheelchair-accessible churches
    Then I see the search results

  Scenario: A search that matches nothing says so
    Given no church is listed in the directory
    And I am on the home page
    When I search for a name no church has
    Then I am told no church matched

  Scenario: Pressing Enter searches
    Given a church is listed in the directory
    And I am on the home page
    When I type that church's name and press Enter
    Then I see the search results

  Scenario: Searching near me works without errors
    Given a church is listed in the directory
    And I have shared my location
    And I am on the home page
    When I ask for churches near me
    Then I am told my location is being used
    And the page raises no script error
