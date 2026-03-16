AI Cost Analysis

Development Costs

I continued to use Claude Code throughout this project. I paid $100 for the 1-month subscription of the MAX package and still did not exceed even 5% total usage over the last week, meaning that the costs for AI during development were negligible -- less than $5 in total.

I also used Github's Spec Kit for spec-driven development. This was free, and although not an AI tool itself, I think that setting it up ahead of time enabled me to move through changes much more rapidly by establishing the scaffolding for my improvement goals and improvement strategies clearly ahead of time.

Reflection Questions

The parts of the AI audit that were most helpful were the test coverage and type safety categories. Each of these categories illuminated the patterns and styles within the codebase clearly, the former with regard to how functionalities were being validated and the latter with regard to the cleanness with which those functionalities had been implemented in the first place.

AI tools were immensely helpful for understanding the codebase. By reasoning about the extensive components and API calls, I was able to navigate their integration with the test suites much more quickly than I could have if I had been reading everything line by line before I started to make changes.

I had to correct the AI multiple times when it tried to make changes to tests. It would try to take shortcuts or suggest fixes that would correct something but cause an issue in another area. The most glaring example was its insistence that the only way to clear out some of the flaky tests was by marking them with test.fixme. I found this to be incorrect: it was possible to change the timing used inside the functions to fix them AND get around the checks being run on commit to GitHub.

My final code changes were 99% AI-generated. Even when I had to make a correction, I would reason with the AI agent to get it to make the correction for me.