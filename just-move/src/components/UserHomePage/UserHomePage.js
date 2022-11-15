import { auth } from '../firebase/firebase';
import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { Goal } from "./Goal";
import { SubGoal } from "./SubGoal";
import PopupGoalForm from "./PopupGoalForm";
import Button from 'rsuite/Button';
import Animation from 'rsuite/Animation';
import { loadData, saveAddGoal, saveDelGoal, hasOutstandingWrites, saveSorting } from "./saving";
import { LoadingScreen } from "../Loading";
import { useBeforeunload } from 'react-beforeunload';
import Modal from 'react-bootstrap/Modal';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import IconButton from 'rsuite/IconButton';
import PlusIcon from '@rsuite/icons/Plus';
import "./UserHomePage.css";

import { TagPicker } from 'rsuite';


const date = new Date();
let day = date.getDate();
let month = date.getMonth() + 1;
let year = date.getFullYear();
let currentDate = `${month}-${day}-${year}`;

function sortHelper(property) {
  return (a, b) => a[property] - b[property];
}

function progressSorter(a, b) {
  if (a.progress.value === undefined && b.progress.value === undefined) {
    return 0;
  } else if (a.progress.value === undefined) {
    return -1;
  } else if (b.progress.value === undefined) {
    return 1;
  } else {
    return (a.progress.value / a.progress.target) - (b.progress.value / b.progress.target);
  }
}

function sortReverser(f) {
  return (a, b) => { return f(b, a) };
}

const sortFuncs = [sortHelper("added"), sortHelper("priority"), progressSorter];

function getSortFunc(i) {
  if (i >= 32) {
    return sortReverser(sortFuncs[i - 32]);
  }
  return sortFuncs[i];
}

export function UserHomePage() {
  const goalRef = useRef(null);
  const subgoalRef = useRef(null);

  const [goals, setGoals] = useState([]);
  const [errModal, setErrModal] = useState(null);
  const [subgoals, setsubGoals] = useState([]);
  const [GoalList, setGoalList] = useState([]);
  const [categoryList, setCategoryList] = useState(['Fitness', 'Work', 'Hobby'].map(
    item => ({
      label: item,
      value: item,
    })
  ));
  const [filters, setFilters] = useState([]);
  const [sortFunc, setSortFunc] = useState(0);

  const [addGoalData, setGoalData] = useState({
    startDate: currentDate,
    goal: "",
    intrinsicMotivation: "",
    extrinsicMotivation: "",
    progress: { value: 1, target: 5 },
    priority: 0,
    added: 0,
    reminderDate: "",
    mostRecentDate: currentDate,
    category: [],
  });

  const [addsubGoalData, setsubGoalData] = useState({
    subgoal: "",
    progress: "",
  });

  const [popupBtn, setPopupBtn] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const handleDeleteGoal = (goalId) => {
    const newGoals = [...goals];

    const index = goals.findIndex((goal) => goal.id === goalId);

    newGoals.splice(index, 1);

    setGoals(newGoals);
    saveDelGoal(goalId).catch(function (error) {
      startModal(error.toString(), "Error Deleting Data");
    });
  }

  const handleEditGoal = (goalId, start, goal, intrinsic, extrinsic, priority, reminder, category) => {
    const newGoals = [...goals];
    const index = goals.findIndex((goal) => goal.id === goalId);
    newGoals[index].startDate = start;
    newGoals[index].goal = goal;
    newGoals[index].intrinsicMotivation = intrinsic;
    newGoals[index].extrinsicMotivation = extrinsic;
    newGoals[index].reminderDate = reminder;
    newGoals[index].category = category;
    newGoals[index].priority = parseInt(priority);

    newGoals.sort(getSortFunc(sortFunc));
    setGoals(newGoals);
    saveAddGoal(goals[index]).catch(function (error) {
      startModal(error.toString(), "Error Editing Data");
    });
  }

  const updateGoalList = (category) => {
    categoryList.push({ label: category, value: category });
  }

  const filteredGoalList = (filters === null || filters.length === 0)
    ? goals
    : goals.filter(goal => {
      for (const category of goal.category) {
        if (filters.includes(category)) {
          return true;
        }
      }
      return false;
    });

  const handlesubGoalsChange = (e) => {
    e.preventDefault();
    const subgoalName = e.target.getAttribute("name");
    const subgoalValue = e.target.value;
    const newsubGoalData = { ...addsubGoalData };
    newsubGoalData[subgoalName] = subgoalValue;
    setsubGoalData(newsubGoalData);
  }

  const handleAddNewSubGoal = (e) => {
    e.preventDefault();

    const newsubGoal = {
      id: nanoid(),
      subgoal: addsubGoalData.subgoal,
      progress: " ",
    }

    const newsubGoals = [...subgoals, newsubGoal];
    if (subgoalRef.current.value !== "") {
      setsubGoals(newsubGoals);
    }
    subgoalRef.current.value = "";

  }

  const handleDeletesubGoal = (subgoalId) => {
    const newsubGoals = [...subgoals];

    const index = subgoals.findIndex((subgoal) => subgoal.id === subgoalId);

    newsubGoals.splice(index, 1);

    setsubGoals(newsubGoals);

    GoalList.splice(index, 1);

  }

  const changeSorting = (newSortFunc) => {
    if (newSortFunc === sortFunc) {
      newSortFunc ^= 32;
    }
    saveSorting(newSortFunc);
    const newGoals = goals;
    newGoals.sort(getSortFunc(newSortFunc));
    setSortFunc(newSortFunc);
    setGoals(newGoals);
  }

  const startModal = (msg, title) => {
    setErrModal({ msg: msg, title: title });
  }

  const navigate = useNavigate();

  const handleLogout = async () => {
    await auth.signOut()
    navigate("/login");
  }

  const getArrowIndic = (i) => {
    if (i === sortFunc) {
      return " \u2193";
    } else if (i === (sortFunc ^ 32)) {
      return " \u2191";
    }
    return "";
  }

  useEffect(function () {
    const unsub = auth.onAuthStateChanged(function () {
      loadData().then(function (data) {
        if (data.sorting !== undefined) {
          changeSorting(data.sorting);
        }
        data.goals.sort(getSortFunc(sortFunc));
        setGoals(data.goals);
        setHasLoaded(true);
        unsub();
      }).catch(function (error) {
        console.log(error);
        startModal(error.toString(), "Error Loading Data");
      });
    });
  }, []);

  useBeforeunload(() => {
    if (hasOutstandingWrites()) {
      // IDEA: Try to emergency save offline. Attempt sync on next login.
      // This will fail for multiple users, and requires Last-Modified tracking.
      return "Your changes have not yet been saved!\nGo online to fix.";
    }
  });

  const ldSc = hasLoaded ? null : <LoadingScreen />;
  const modal = errModal ? (<Modal show={true} onHide={() => setErrModal(null)} centered size="md">
    <Modal.Header closeButton><Modal.Title>{errModal.title}</Modal.Title></Modal.Header>
    <Modal.Body><p>{errModal.msg}</p></Modal.Body>
  </Modal >) : null;

  return (
    <div>
      {ldSc}
      <div>
        <button className="btn btn-danger m-2" style={{ position: "absolute", right: 0 }} onClick={handleLogout}>Log Out</button>
        <br></br>
        <div style={{ textAlign: "center" }}>
          <Animation.Slide in={true} placement={React.useState('left')}>
            <h1
              style={{ color: "#38ACEC" }}>
              Just Move
            </h1>
          </Animation.Slide>
          <br></br>
          <Animation.Slide in={true} placement={React.useState('right')}>
            <Button
              onClick={() => setPopupBtn(true)}
              color='green'
              appearance='primary'
              size='lg'
              style={{ fontSize: "20px" }}>
              Add a new goal!
            </Button>
          </Animation.Slide>
        </div>
        <PopupGoalForm
          trigger={popupBtn}
          setPopupBtnTrigger={setPopupBtn}
          goalRef={goalRef}
          addGoalData={addGoalData}
          setGoalData={setGoalData}
          goals={goals}
          setGoals={setGoals}
          GoalList={GoalList}
          setGoalList={setGoalList}
          startModal={startModal}
          sortFunc={getSortFunc(sortFunc)}
        >
        </PopupGoalForm>
        <table id="goals-table" className="table mt-5">
          <Animation.Bounce in={true}>
            <thead>
              <tr>
                <th sope="col" className="th-hoverable" onClick={() => changeSorting(0)}>Start Date{
                  getArrowIndic(0)
                }</th>
                <th scope="col">Goal</th>
                <th scope="col">Intrinsic Motivations</th>
                <th scope="col">Extrinsic Motivations</th>
                <th scope="col" className="th-hoverable" onClick={() => changeSorting(33)}>Priority{
                  getArrowIndic(1)
                }</th>
                <th scope="col">Reminder Date</th>
                <th scope="col">Most Recent Date</th>
                <th scope="col" className="th-hoverable" onClick={() => changeSorting(2)}>Progress Bar{
                  getArrowIndic(2)
                }</th>
                <th scope="col">
                  Categories
                  <TagPicker
                    data={categoryList}
                    style={{ width: 300 }}
                    menuStyle={{ width: 300 }}
                    onChange={(value) => {
                      setFilters(value);
                    }}
                  />
                </th>
              </tr >
            </thead >

          </Animation.Bounce >
          <tbody id="goals-table-body">
            {filteredGoalList.map((newGoal) => (
              <Goal props={newGoal} key={newGoal.id} handleDeleteGoal={handleDeleteGoal} handleEditGoal={handleEditGoal} categoryList={categoryList} updateGoalList={updateGoalList} />
            ))}
          </tbody>
        </table >
        <form onSubmit={handleAddNewSubGoal}>
          <label>
            SubGoal:
          </label>
          <input
            type="input"
            name="subgoal"
            placeholder="Enter your tasks for this goal..."
            ref={subgoalRef}
            className="form-control"
            onChange={handlesubGoalsChange}
          />

          <IconButton type="submit" icon={<PlusIcon />} appearance="primary" color="cyan">Create</IconButton>
        </form>

        <table id="subgoals-table" className="table mt-5">
          <thead>
            <tr>
              <th scope="col">Tasks</th>
              <th scope="col">Goal</th>
              <th scope="col">Progress</th>
            </tr>

          </thead>

          <tbody id="subgoals-table-body">
            {subgoals.map((newsubGoal) => (
              <SubGoal props={newsubGoal} key={newsubGoal.id} list={GoalList} handleDeletesubGoal={handleDeletesubGoal} />
            ))}
          </tbody>
        </table>

      </div >
      {modal}
    </div >
  );
}
