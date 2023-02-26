// Get the release that triggered this workflow
const release = context.payload.release;

// Get the release date and format it like yyyy-mm-dd
const releaseDate = new Date(release.published_at).toISOString().slice(0, 10);

// Get the previous release for the current repository
const previousRelease = await github.repos.listReleases({
  owner: context.repo.owner,
  repo: context.repo.repo,
}).filter(r => r.target_commitish === release.target_commitish)[1];

console.info("Current release:", release.tag_name);
console.info("Previous release:", previousRelease.tag_name);

// Identify the last commit of the previous release
const shaOfCommitFromPreviousRelease = previousRelease ? await github.repos.listCommits({
  owner: context.repo.owner,
  repo: context.repo.repo,
  sha: previousRelease.tag_name,
  per_page: 1
})[0].sha : "???";

console.info("Last SHA from previous release:", shaOfCommitFromPreviousRelease);

// Safeguard
const maxCommitsInRelease = 200;

// Collect the last maxCommitsInRelease commits from the release branch
const commits = [];
let page = 1;
while (commits.length < maxCommitsInRelease) {
  const apiResponse = await github.repos.listCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    sha: release.tag_name,
    per_page: 100,
    page: page,
  });
  commits.push(...apiResponse.data);
  if (apiResponse.data.length === 0 || apiResponse.data.length < 100) {
    break;
  }
  page++;
  break;
}

// Find the number of commits that are new in this release
// New release's last commit starts at index 0
// Last commit of previous release has index X, where X > 0
const commitsInRelease = commits.findIndex((commit) => {
  return commit.sha === shaOfCommitFromPreviousRelease;
});

const commitsToIncludeInReleaseNotes = commitsInRelease >= 0 ? commitsInRelease : maxCommitsInRelease;
console.info("Number of commits to include in release notes:", commitsToIncludeInReleaseNotes);

// Construct the release notes from the list of commits
const commitMessages = commits
  .slice(0, commitsInRelease)
  .reverse()
  .map((commit) => {
    const split = commit.commit.message.split("\n");
    const title = `**${split[0].replace(/\(#\d+\)/g, "").trim()}**`; // Remove (#XXXX) from titles
    const description = split.slice(1).join("\n").trim();
    return `${title}\n${description}\n`;
  })
  .join("\n");
const newDescription = `## ${release.name}\n_${releaseDate}_\n${commitMessages}`.trim();

// Update the release notes
await github.repos.updateRelease({
  owner: context.repo.owner,
  repo: context.repo.repo,
  release_id: release.id,
  body: newDescription,
});
