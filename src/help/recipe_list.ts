// The recipes as shown in the game's help panel and on the help page: a table
// of contents first, then each group of recipes, each with its title, what it
// does and its program. The help's search reads the same recipes as text
// (recipesText), so what is shown and what is found never differ.
import { t } from '../i18n/messages';
import { createButton, createElement } from '../ui/dom';
import { renderMarkup } from '../ui/markup';
import { local } from '../ui/tutorial_panel';
import { RECIPES_INTRO, RECIPES_OUTRO, RECIPE_GROUPS } from './recipes';

/** The recipes under a table of contents: a title there goes to its recipe, and each group ends with a way back up. */
export function renderRecipes(): HTMLElement {
  const list = createElement('div', 'help-recipes');
  const contents = createElement('nav', 'help-recipe-contents');
  contents.append(createElement('h3', 'help-recipe-contents-title', t('help.recipes.contents')));
  list.append(renderMarkup(local(RECIPES_INTRO)), contents);

  for (const group of RECIPE_GROUPS) {
    const section = createElement('section', 'help-recipe-group');
    const heading = createElement('h3', 'help-word-group-title', local(group.title));
    section.append(heading);

    const entries = createElement('div', 'help-recipe-contents-group');
    entries.append(createButton('help-recipe-contents-heading', local(group.title), '', () => heading.scrollIntoView({ block: 'start' })));
    for (const recipe of group.recipes) {
      const title = createElement('h4', 'help-recipe-title', local(recipe.title));
      title.dataset.recipe = recipe.id;
      entries.append(createButton('help-recipe-link', local(recipe.title), '', () => title.scrollIntoView({ block: 'start' })));
      section.append(title, renderMarkup(`${local(recipe.text)}\n\n\`\`\`\n${recipe.code}\n\`\`\``));
    }
    contents.append(entries);
    section.append(createButton('help-recipe-back', t('help.recipes.back'), '', () => contents.scrollIntoView({ block: 'start' })));
    list.append(section);
  }
  list.append(renderMarkup(local(RECIPES_OUTRO)));
  return list;
}
