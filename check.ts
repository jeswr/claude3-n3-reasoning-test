import { DataFactory, Literal, NamedNode, Quad, Store, Writer } from "rdf-js";
import { namedNode, literal, quad } from "@rdfjs/data-model";

const RDF = new NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#");
const REASON = new NamedNode("http://www.w3.org/2000/10/swap/reason#");
const LOG = new NamedNode("http://www.w3.org/2000/10/swap/log#");
const REI = new NamedNode("http://www.w3.org/2004/06/rei#");

const TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const GIVES = namedNode("http://www.w3.org/2000/10/swap/reason#gives");
const EVIDENCE = namedNode("http://www.w3.org/2000/10/swap/reason#evidence");
const RULE = namedNode("http://www.w3.org/2000/10/swap/reason#rule");
const BINDING = namedNode("http://www.w3.org/2000/10/swap/reason#binding");
const VARIABLE = namedNode("http://www.w3.org/2000/10/swap/reason#variable");
const BOUNDTO = namedNode("http://www.w3.org/2000/10/swap/reason#boundTo");
const PREMISES = namedNode("http://www.w3.org/2000/10/swap/reason#Premise");
const INFERENCE = namedNode("http://www.w3.org/2000/10/swap/reason#Inference");
const CONJUNCTION = namedNode("http://www.w3.org/2000/10/swap/reason#Conjunction");
const FACT = namedNode("http://www.w3.org/2000/10/swap/reason#Fact");
const CONCLUSION = namedNode("http://www.w3.org/2000/10/swap/reason#Conclusion");
const EXTRACTION = namedNode("http://www.w3.org/2000/10/swap/reason#Extraction");
const BECAUSE = namedNode("http://www.w3.org/2000/10/swap/reason#because");
const INCLUDES = namedNode("http://www.w3.org/2000/10/swap/log#includes");
const SUPPORTS = namedNode("http://www.w3.org/2000/10/swap/log#supports");
const IMPLIES = namedNode("http://www.w3.org/2000/10/swap/log#implies");

const factory = DataFactory;

class InvalidProof extends Error {
  constructor(message: string) {
    super(message);
  }
}

class PolicyViolation extends InvalidProof {
  constructor(message: string) {
    super(message);
  }
}

class LogicalFallacy extends InvalidProof {
  constructor(message: string) {
    super(message);
  }
}

interface Policy {
  documentOK(uri: NamedNode): boolean;
  assumes(formula: Store): boolean;
}

class AllPremises implements Policy {
  documentOK(_: NamedNode): boolean {
    return false;
  }

  assumes(_: Store): boolean {
    return true;
  }
}

class Checker {
  private store: Store;
  private checked: Map<NamedNode, Store> = new Map();

  constructor(proof: Store) {
    this.store = proof;
  }

  private getConjecture(): [Store | undefined, NamedNode | undefined] {
    const proofStep = this.store.getQuads(null, TYPE, REASON.node("Proof"), null)[0];
    if (!proofStep) throw new InvalidProof("no main :Proof step");

    const subject = proofStep.subject;
    const givenFormula = this.store.getQuads(subject, GIVES, null, null)[0];
    if (!givenFormula) throw new InvalidProof("main Proof step has no :gives");

    return [this.store.dataset(givenFormula.object), subject];
  }

  private getResult(reason: NamedNode, policy: Policy, level = 0): Store {
    const cached = this.checked.get(reason);
    if (cached) return cached;

    const givenFormula = this.store.getQuads(reason, GIVES, null, null)[0];
    if (!givenFormula) throw new InvalidProof("No reason for " + reason);

    const reasonType = this.store.getQuads(reason, TYPE, null, null)[0];
    if (!reasonType) throw new InvalidProof(reason + " does not have the type of any reason");

    const type = reasonType.object;
    if (type.equals(PREMISES)) {
      const formula = givenFormula.object as Literal;
      if (!policy.assumes(this.store.dataset(formula))) {
        throw new PolicyViolation("I cannot assume " + formula);
      }
      this.checked.set(reason, this.store.dataset(formula));
      return this.store.dataset(formula);
    } else if (type.equals(INFERENCE)) {
      const result = this.checkGMP(reason, policy, level + 1);
      this.checked.set(reason, result);
      return result;
    } else if (type.equals(CONJUNCTION)) {
      const result = this.checkConjunction(reason, policy, level + 1);
      this.checked.set(reason, result);
      return result;
    } else if (type.equals(FACT)) {
      const result = this.checkBuiltin(reason, givenFormula.object as Store, policy, level + 1);
      this.checked.set(reason, result);
      return result;
    } else if (type.equals(CONCLUSION)) {
      const result = this.checkSupports(reason, givenFormula.object as Store, policy, level + 1);
      this.checked.set(reason, result);
      return result;
    } else if (type.equals(EXTRACTION)) {
      const result = this.checkExtraction(reason, givenFormula.object as Store, policy, level + 1);
      this.checked.set(reason, result);
      return result;
    } else {
      throw new InvalidProof("Unknown reason type: " + type);
    }
  }

  public check(policy: Policy): Store {
    const [givenFormula, proofStep] = this.getConjecture();
    if (!givenFormula || !proofStep) throw new InvalidProof("Invalid proof");

    return this.getResult(proofStep, policy);
  }

  private checkGMP(reason: NamedNode, policy: Policy, level: number): Store {
    const evidenceQuads = this.store.getQuads(reason, EVIDENCE, null, null);
    const evidence = evidenceQuads.map((quad) => this.getResult(quad.object, policy, level));

    const ruleQuad = this.store.getQuads(reason, RULE, null, null)[0];
    if (!ruleQuad) throw new InvalidProof("No rule given for " + reason);
    const rule = this.getResult(ruleQuad.object, policy, level);

    const bindings: Map<NamedNode, NamedNode | Literal> = new Map();
    const bindingQuads = this.store.getQuads(reason, BINDING, null, null);
    for (const bindingQuad of bindingQuads) {
      const variableQuad = this.store.getQuads(bindingQuad.object, VARIABLE, null, null)[0];
      if (!variableQuad) throw new InvalidProof("No variable given for " + bindingQuad.object);
      const variable = variableQuad.object;

      const boundToQuad = this.store.getQuads(bindingQuad.object, BOUNDTO, null, null)[0];
      if (!boundToQuad) throw new InvalidProof("No bound value given for " + bindingQuad.object);
      const value = boundToQuad.object;

      bindings.set(variable, value);
    }

    const ruleImpliesQuad = rule.getQuads(null, IMPLIES, null, null)[0];
    if (!ruleImpliesQuad) throw new InvalidProof("Rule has no log:implies predicate");

    const antecedent = this.applyBindings(ruleImpliesQuad.subject, bindings);
    const consequent = this.applyBindings(ruleImpliesQuad.object, bindings);

    const evidenceStore = evidence.reduce((acc, store) => acc.concat(store), factory.dataset());
    if (!this.n3Entails(evidenceStore, antecedent)) {
      throw new LogicalFallacy("Can't find antecedent in evidence");
    }

    return consequent;
  }

  private checkConjunction(reason: NamedNode, policy: Policy, level: number): Store {
    const componentQuads = this.store.getQuads(reason, namedNode("http://www.w3.org/2000/10/swap/reason#component"), null, null);
    const components = componentQuads.map((quad) => this.getResult(quad.object, policy, level));

    return components.reduce((acc, store) => acc.concat(store), factory.dataset());
  }

  private checkBuiltin(reason: NamedNode, formula: Store, policy: Policy, level: number): Store {
    const [subject, predicate, object] = this.getAtomicFormulaTerms(formula);

    if (predicate.equals(INCLUDES)) {
      if (this.n3Entails(subject, object)) {
        return formula;
      } else {
        throw new LogicalFallacy("Include test failed");
      }
    }

    if (!(predicate.termType === "NamedNode")) {
      throw new PolicyViolation("Claimed as fact, but predicate is not built-in");
    }

    // TODO: Implement built-in evaluation

    throw new LogicalFallacy("Built-in fact does not give correct results");
  }

  private checkSupports(reason: NamedNode, formula: Store, policy: Policy, level: number): Store {
    const [subject, predicate, object] = this.getAtomicFormulaTerms(formula);

    if (!predicate.equals(SUPPORTS)) {
      throw new InvalidProof("Supports step is not a log:supports");
    }

    const becauseQuad = this.store.getQuads(reason, BECAUSE, null, null)[0];
    if (!becauseQuad) throw new InvalidProof("No source formula given for " + reason);

    const nestedResult = this.getResult(becauseQuad.object, new Assumption(subject), level + 1);
    if (!this.n3Entails(nestedResult, object)) {
      throw new LogicalFallacy("Extraction not included in formula");
    }

    return formula;
  }

  private checkExtraction(reason: NamedNode, formula: Store, policy: Policy, level: number): Store {
    const becauseQuad = this.store.getQuads(reason, BECAUSE, null, null)[0];
    if (!becauseQuad) throw new InvalidProof("No source formula given for " + reason);

    const sourceFormula = this.getResult(becauseQuad.object, policy, level + 1);
    if (!this.n3Entails(sourceFormula, formula)) {
      throw new LogicalFallacy("Extraction not included in formula");
    }

    return formula;
  }

  private getAtomicFormulaTerms(formula: Store): [NamedNode | Literal, NamedNode, NamedNode | Literal] {
    const [quad] = formula.getQuads(null, null, null, null);
    if (!quad) throw new InvalidProof("Expected atomic formula");

    return [quad.subject, quad.predicate, quad.object];
  }

  private applyBindings(formula: Store, bindings: Map<NamedNode, NamedNode | Literal>): Store {
    const result = factory.dataset();
    for (const quad of formula.getQuads(null, null, null, null)) {
      const subject = bindings.get(quad.subject) || quad.subject;
      const predicate = bindings.get(quad.predicate) || quad.predicate;
      const object = bindings.get(quad.object) || quad.object;

      result.add(quad(subject, predicate, object));
    }
    return result;
  }

  private n3Entails(subject: Store, object: Store): boolean {
    // TODO: Implement n3Entails logic
    return false;
  }
}

class Assumption implements Policy {
  private premise: Store;

  constructor(premise: Store) {
    this.premise = premise;
  }

  documentOK(_: NamedNode): boolean {
    return false;
  }

  assumes(formula: Store): boolean {
    // TODO: Implement n3Entails logic
    return false;
  }
}
