import context from '../context.json'

const release = context.payload.release;
console.log("release", release);

// Get the previous release for the current repository
const releases = await github.repos.listReleases({
  owner: context.repo.owner,
  repo: context.repo.repo,
});
console.log("releases", releases);
const previousRelease = releases.data.find(
  (release) => release.tag_name !== release.tag_name
);

const commits = [];
let page = 1;
console.log("context", context);
console.log("release", release);
const comparedCommits = await github.repos
  .compareCommits({
    owner: context.repo.owner,
    repo: context.repo.repo,
    base: "9.99999",
    head: release.tag_name,
  })
  .then((response) => response.data.commits).length;
console.log("comparedCommits", comparedCommits);
const commitsInRelease = 10;
while (commits.length < commitsInRelease) {
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
const commitMessages = commits
  .slice(0, commitsInRelease)
  .reverse()
  .map((commit) => {
    const split = commit.commit.message.split("\n");
    const title = `**${split[0].replace(/\(#\d+\)/g, "").trim()}**`;
    const description = split.slice(1).join("\n").trim();
    return `${title}\n${description}\n`;
  })
  .join("\n");
const releaseDate = new Date(release.published_at).toISOString().slice(0, 10);
const newDescription =
  `## ${release.name}\n_${releaseDate}_\n${commitMessages}`.trim();
await github.repos.updateRelease({
  owner: context.repo.owner,
  repo: context.repo.repo,
  release_id: release.id,
  body: newDescription,
});
